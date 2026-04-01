import { api } from "./axios";

export async function getWalletOverview() {
  const response = await api.get("/wallet/overview");
  return response.data.data;
}

export async function getWalletBalance() {
  const response = await api.get("/wallet/balance");
  return response.data.data as { balance: number };
}

export async function getFundingStatus(
  clientId: string,
  budgetMin?: number | null,
  budgetMax?: number | null,
  contractId?: string | null,
): Promise<{ wallet_balance: number; escrow_held: number }> {
  const params: Record<string, string> = { clientId };
  if (budgetMin != null) params.budgetMin = String(budgetMin);
  if (budgetMax != null) params.budgetMax = String(budgetMax);
  if (contractId) params.contractId = contractId;
  const response = await api.get("/wallet/funding-status", { params });
  return response.data.data;
}
