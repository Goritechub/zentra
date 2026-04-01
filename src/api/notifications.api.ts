import { api } from "./axios";

export async function getNotificationsList() {
  const response = await api.get("/notifications");
  return response.data.data.notifications || [];
}

export async function markNotificationRead(id: string) {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await api.patch("/notifications/read-all");
  return response.data;
}

export async function createNotification(payload: {
  userId: string;
  type: string;
  title: string;
  message: string;
  contractId?: string | null;
  linkUrl?: string | null;
}) {
  const response = await api.post("/notifications", payload);
  return response.data;
}
