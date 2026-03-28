import { api } from "./axios";

export async function getAdminWaitlistEntries() {
  const response = await api.get("/admin/waitlist");
  return response.data.data as { entries: any[] };
}

export async function getAdminWaitlistStats() {
  const response = await api.get("/admin/waitlist/stats");
  return response.data.data as { total: number; clients: number; experts: number };
}

export async function deleteAdminWaitlistEntry(id: string) {
  const response = await api.delete(`/admin/waitlist/${id}`);
  return response.data.data;
}
