import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { filterMessageContent } from "@/lib/message-filters";
import { vetAttachmentName } from "@/lib/content-vetting";
import { toast } from "sonner";

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

    const [{ data: msgs }, { data: attachments }] = await Promise.all([
      supabase
        .from("contract_messages")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: true }),
      supabase
        .from("contract_attachments")
        .select("id, message_id, file_url, file_name, file_type")
        .eq("contract_id", contractId)
        .eq("context", "chat"),
    ]);

    const attachmentMap = new Map<string, any[]>();
    (attachments || []).forEach((a: any) => {
      if (!a.message_id) return;
      if (!attachmentMap.has(a.message_id)) attachmentMap.set(a.message_id, []);
      attachmentMap.get(a.message_id)!.push(a);
    });

    const enriched: ContractMessage[] = (msgs || []).map((m: any) => ({
      ...m,
      attachments: attachmentMap.get(m.id) || [],
    }));

    setMessages(enriched);
    setLoading(false);

    // Mark unread as read
    await supabase
      .from("contract_messages")
      .update({ is_read: true } as any)
      .eq("contract_id", contractId)
      .neq("sender_id", user.id)
      .eq("is_read", false);
  }, [contractId, user]);

  const sendMessage = async (content: string, files?: File[]): Promise<boolean> => {
    if (!user || !contractId) return false;
    if (!content.trim() && (!files || files.length === 0)) return false;

    if (content.trim()) {
      const result = filterMessageContent(content.trim());
      if (result.blocked) {
        toast.error(result.reason || "Message contains prohibited content");
        return false;
      }
    }

    setSending(true);
    try {
      // Upload files first
      const uploadedFiles: { url: string; name: string; type: string }[] = [];
      if (files?.length) {
        for (const file of files) {
          const nameCheck = vetAttachmentName(file.name);
          if (nameCheck.blocked) {
            toast.error(`${file.name}: ${nameCheck.reason}`);
            continue;
          }
          const path = `${contractId}/${user.id}/${Date.now()}_${file.name}`;
          const { error } = await supabase.storage.from("contract-attachments").upload(path, file);
          if (error) { toast.error(`Failed to upload ${file.name}`); continue; }
          const { data } = supabase.storage.from("contract-attachments").getPublicUrl(path);
          uploadedFiles.push({ url: data.publicUrl, name: file.name, type: file.type });
        }
      }

      const { data: msg, error } = await supabase
        .from("contract_messages")
        .insert({
          contract_id: contractId,
          sender_id: user.id,
          content: content.trim() || "📎 Attachment",
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Insert attachment records
      if (uploadedFiles.length > 0 && msg) {
        for (const f of uploadedFiles) {
          await supabase.from("contract_attachments").insert({
            contract_id: contractId,
            message_id: msg.id,
            uploaded_by: user.id,
            file_url: f.url,
            file_name: f.name,
            file_type: f.type,
            context: "chat",
          } as any);
        }
      }

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
