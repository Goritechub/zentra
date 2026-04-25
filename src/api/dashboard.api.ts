import { api } from "./axios";

export async function getDashboardOverview() {
  const response = await api.get<{
    success: boolean;
    data: {
      stats: { jobs: number; proposals: number; messages: number; contracts: number };
      recentJobs: any[];
      freelancerProfile: any;
      isAdmin: boolean;
      walletBalance: number;
      completedContracts: number;
      recentActivity: any[];
      kyc: { kyc_status: string; verification_level: string; zentra_verified: boolean } | null;
    };
  }>("/dashboard/overview");
  return response.data.data;
}
