import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  attachments: string[];
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  participant: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  lastMessage: Message | null;
  unreadCount: number;
}

export function useMessages(selectedUserId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data: allMessages, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const conversationMap = new Map<string, Message[]>();
      allMessages?.forEach((msg) => {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, []);
        }
        conversationMap.get(partnerId)!.push(msg);
      });

      const partnerIds = Array.from(conversationMap.keys());
      if (partnerIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", partnerIds);

      if (profilesError) throw profilesError;

      const conversationList: Conversation[] = partnerIds.map((partnerId) => {
        const partnerMessages = conversationMap.get(partnerId) || [];
        const profile = profiles?.find((p) => p.id === partnerId);
        const unreadCount = partnerMessages.filter(
          (m) => m.receiver_id === user.id && !m.is_read
        ).length;

        return {
          id: partnerId,
          participant: {
            id: partnerId,
            full_name: profile?.full_name || "Unknown User",
            avatar_url: profile?.avatar_url,
          },
          lastMessage: partnerMessages[0] || null,
          unreadCount,
        };
      });

      conversationList.sort((a, b) => {
        const timeA = a.lastMessage?.created_at || "";
        const timeB = b.lastMessage?.created_at || "";
        return timeB.localeCompare(timeA);
      });

      setConversations(conversationList);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchMessages = useCallback(async () => {
    if (!user || !selectedUserId || !UUID_REGEX.test(selectedUserId)) return;

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("receiver_id", user.id)
        .eq("sender_id", selectedUserId);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, [user, selectedUserId]);

  const sendMessage = async (content: string, attachments?: string[]): Promise<boolean> => {
    if (!user || !selectedUserId || (!content.trim() && (!attachments || attachments.length === 0))) return false;

    if (!UUID_REGEX.test(selectedUserId)) {
      toast({
        title: "Cannot send message",
        description: "This user profile is not available for messaging yet.",
        variant: "destructive",
      });
      return false;
    }

    setSending(true);
    try {
      const response = await supabase.functions.invoke("moderate-message", {
        body: {
          receiver_id: selectedUserId,
          content: content.trim(),
          attachments: attachments || [],
        },
      });

      if (response.error) {
        const errorData = response.error;
        toast({
          title: "Message blocked",
          description: typeof errorData === 'object' && errorData.message
            ? errorData.message
            : "Your message contains content that violates our policies.",
          variant: "destructive",
        });
        return false;
      }

      if (response.data?.warnings?.length > 0) {
        toast({
          title: "Warning",
          description: response.data.warnings.join(", "),
        });
      }

      return true;
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchConversations();

    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          fetchConversations();
          if (selectedUserId) {
            fetchMessages();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUserId, fetchConversations, fetchMessages]);

  useEffect(() => {
    if (selectedUserId) {
      fetchMessages();
    }
  }, [selectedUserId, fetchMessages]);

  return {
    conversations,
    messages,
    loading,
    sending,
    sendMessage,
    refreshConversations: fetchConversations,
  };
}
