import { api } from "./axios";

export async function validateUnsubscribeToken(token: string) {
  const response = await api.get<{ valid: boolean; reason?: string }>(
    "/unsubscribe/validate",
    { params: { token } },
  );
  return response.data;
}

export async function processUnsubscribe(token: string) {
  const response = await api.post<{ success: boolean; reason?: string }>("/unsubscribe", { token });
  return response.data;
}
