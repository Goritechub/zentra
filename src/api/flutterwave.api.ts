import { api } from "@/api/axios";

interface InitiateFundingResponse {
  paymentLink: string;
  txRef: string;
  amount: number;
  currency: string;
}

export async function initiateFunding(
  amount: number,
  currency: string,
  email: string,
  redirectUrl: string,
): Promise<InitiateFundingResponse> {
  const response = await api.post<{ success: boolean; data: InitiateFundingResponse }>(
    "/flutterwave/fund/initiate",
    { amount, currency, email, redirect_url: redirectUrl },
  );
  return response.data.data;
}

export interface InitiatePayoutParams {
  amount: number;           // in currency units (e.g. 38 for £38, or 78000 for ₦78k)
  currency: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  narration?: string;
  destinationBranchCode?: string;
}

export interface InitiatePayoutResponse {
  transfer_id: string | number;
  ngn_deducted: number;
  payout_amount: number;
  currency: string;
  reference: string;
}

export async function initiatePayout(
  params: InitiatePayoutParams,
): Promise<InitiatePayoutResponse> {
  const response = await api.post<{ success: boolean; data: InitiatePayoutResponse }>(
    "/flutterwave/payout",
    {
      amount: params.amount,
      currency: params.currency,
      bank_code: params.bankCode,
      account_number: params.accountNumber,
      account_name: params.accountName,
      narration: params.narration,
      destination_branch_code: params.destinationBranchCode,
    },
  );
  return response.data.data;
}
