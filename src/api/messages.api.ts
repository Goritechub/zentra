import { api } from "./axios";

export async function getMessagesConversations() {
  const response = await api.get("/messages/conversations");
  return response.data.data;
}

export async function getUnreadMessagesCount() {
  const response = await api.get("/messages/unread-count");
  return response.data.data.count || 0;
}

export async function hideConversations(contractIds: string[]) {
  const response = await api.post("/messages/conversations/hide", { contractIds });
  return response.data.data;
}

export async function hideConversation(contractId: string) {
  const response = await api.post(`/messages/conversations/${contractId}/hide`);
  return response.data.data;
}

export async function unhideConversation(contractId: string) {
  const response = await api.delete(`/messages/conversations/${contractId}/hide`);
  return response.data.data;
}
