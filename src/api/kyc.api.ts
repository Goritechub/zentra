import { api } from "./axios";

export interface KycVerification {
  user_id: string;
  kyc_status: string;
  verification_level: string | null;
  zentra_verified: boolean | null;
  [key: string]: unknown;
}

export async function getKycVerification(userId?: string) {
  const response = await api.get("/kyc/verification", {
    params: userId ? { userId } : undefined,
  });
  return response.data.data as { verification: KycVerification | null };
}
