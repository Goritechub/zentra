import { api } from "@/api/axios";

/**
 * Sends a broadcast notification to all users via NestJS.
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
  const res = await api.post("/admin/broadcast", { title, message, type, link_url });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}
