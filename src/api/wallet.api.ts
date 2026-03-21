import { api } from "./axios";

export async function getWalletOverview() {
  const response = await api.get("/wallet/overview");
  return response.data.data;
}

export async function getWalletBalance() {
  const response = await api.get("/wallet/balance");
  return response.data.data as { balance: number };
}
