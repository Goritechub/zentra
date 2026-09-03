import { api } from "./axios";
import type { Complaint, SupportChat, SupportChatMessage } from "@/types/support";

export async function createSupportComplaint(payload: {
  subject: string;
  category: string;
  message: string;
}) {
  const response = await api.post("/support/complaints", payload);
  return response.data.data;
}

export async function getMySupportComplaints() {
  const response = await api.get("/support/complaints/mine");
  return response.data.data as { complaints: Complaint[] };
}

export async function getSupportChat() {
  const response = await api.get("/support/chat");
  return response.data.data as { chatId: string; messages: SupportChatMessage[] };
}

export async function sendSupportChatMessage(message: string) {
  const response = await api.post("/support/chat/messages", { message });
  return response.data.data as { chatId: string };
}

export async function getAdminSupportSettings() {
  const response = await api.get("/support/admin/settings");
  return response.data.data as { email: string; phone: string; whatsapp: string };
}

export async function updateAdminSupportSettings(email: string, phone: string, whatsapp: string) {
  const response = await api.patch("/support/admin/settings", { email, phone, whatsapp });
  return response.data.data;
}

export async function getAdminSupportComplaints(status: string) {
  const response = await api.get("/support/admin/complaints", { params: { status } });
  return response.data.data as { complaints: Complaint[] };
}

export async function updateAdminSupportComplaintStatus(complaintId: string, status: string) {
  const response = await api.patch(`/support/admin/complaints/${complaintId}/status`, { status });
  return response.data.data;
}

export async function getAdminSupportChats() {
  const response = await api.get("/support/admin/chats");
  return response.data.data as { chats: SupportChat[] };
}

export async function getAdminSupportChatMessages(chatId: string) {
  const response = await api.get(`/support/admin/chats/${chatId}/messages`);
  return response.data.data as { messages: SupportChatMessage[] };
}

export async function sendAdminSupportChatMessage(chatId: string, message: string) {
  const response = await api.post(`/support/admin/chats/${chatId}/messages`, { message });
  return response.data.data;
}
