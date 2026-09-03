import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { filterMessageContent } from "@/lib/message-filters";
import { toast } from "sonner";
import { getContractMessages, sendContractMessage } from "@/api/contracts.api";

export interface ContractMessage {
  id: string;
  contract_id: string;
  sender_id: string;
  content: string;
  is_system_message: boolean;
  is_read: boolean;
  edited_at: string | null;
  created_at: string;
  attachments?: { id: string; file_url: string; file_name: string; file_type: string | null }[];
}

export function useContractMessages(contractId?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ContractMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!contractId || !user) { setLoading(false); return; }
    try {
      const msgs = await getContractMessages(contractId);
      setMessages(msgs);
    } catch {
      // silently fail on background refresh
    } finally {
      setLoading(false);
    }
  }, [contractId, user]);

  const sendMessage = async (
    content: string,
    attachments?: { url: string; name: string; type: string }[],
  ): Promise<boolean> => {
    if (!user || !contractId) return false;
    if (!content.trim() && (!attachments || attachments.length === 0)) return false;

    if (content.trim()) {
      const result = filterMessageContent(content.trim());
      if (result.blocked) {
        toast.error(result.reason || "Message contains prohibited content");
        return false;
      }
    }

    setSending(true);
    try {
      await sendContractMessage(contractId, content, attachments);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
      return false;
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    if (!contractId) return;

    const channel = supabase
      .channel(`contract-msgs-${contractId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contract_messages", filter: `contract_id=eq.${contractId}` },
        () => fetchMessages()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [contractId, fetchMessages]);

  return { messages, loading, sending, sendMessage, refreshMessages: fetchMessages };
}
