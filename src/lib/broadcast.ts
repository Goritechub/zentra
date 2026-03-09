import { supabase } from "@/integrations/supabase/client";

/**
 * Sends a broadcast notification to all users via the edge function.
 * Only callable by super admins.
 */
export async function broadcastNotification({
  title,
  message,
  type = "platform_announcement",
  link_url,
}: {
  title: string;
  message: string;
  type?: string;
  link_url?: string;
}) {
  const { data, error } = await supabase.functions.invoke("broadcast-notification", {
    body: { title, message, type, link_url },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
