import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { filterMessageContent } from "@/lib/message-filters";
import { toast } from "sonner";

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  content: string;
  is_system_message: boolean;
  is_read: boolean;
  created_at: string;
}

export function useDisputeMessages(disputeId?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!disputeId || !user) { setLoading(false); return; }

    const { data: msgs } = await supabase
      .from("dispute_messages")
      .select("*")
      .eq("dispute_id", disputeId)
      .order("created_at", { ascending: true });

    setMessages((msgs as DisputeMessage[]) || []);
    setLoading(false);

    // Mark unread as read
    await supabase
      .from("dispute_messages")
      .update({ is_read: true } as any)
      .eq("dispute_id", disputeId)
      .neq("sender_id", user.id)
      .eq("is_read", false);
  }, [disputeId, user]);

  const sendMessage = async (content: string): Promise<boolean> => {
    if (!user || !disputeId) return false;
    if (!content.trim()) return false;

    const result = filterMessageContent(content.trim());
    if (result.blocked) {
      toast.error(result.reason || "Message contains prohibited content");
      return false;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from("dispute_messages")
        .insert({
          dispute_id: disputeId,
          sender_id: user.id,
          content: content.trim(),
        } as any);

      if (error) throw error;
      return true;
    } catch (error: any) {
      toast.error(error?.message || "Failed to send message");
      return false;
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    if (!disputeId) return;

    const channel = supabase
      .channel(`dispute-msgs-${disputeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dispute_messages", filter: `dispute_id=eq.${disputeId}` },
        () => fetchMessages()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [disputeId, fetchMessages]);

  return { messages, loading, sending, sendMessage, refreshMessages: fetchMessages };
}
