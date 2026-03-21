import { api } from "./axios";

export async function getNotificationsList() {
  const response = await api.get("/notifications");
  return response.data.data.notifications || [];
}
