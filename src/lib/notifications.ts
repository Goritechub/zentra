import { supabase } from "@/integrations/supabase/client";

/**
 * Insert a notification for a user. Call from client-side after contract status changes.
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  contractId,
}: {
  userId: string;
  type: string;
  title: string;
  message: string;
  contractId?: string | null;
}) {
  return supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    contract_id: contractId || null,
  } as any);
}
