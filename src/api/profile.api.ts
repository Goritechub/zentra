import { api } from "./axios";

export async function getMyProfileOverview() {
  const response = await api.get("/profile/me");
  return response.data.data;
}

export async function getMyProfileDeleteChecks() {
  const response = await api.get("/profile/delete-checks");
  return response.data.data as {
    walletBalance: number;
    activeContracts: number;
    activeJobs: number;
    hasAuthCode: boolean;
  };
}

export async function updateMyAvatarUrl(avatarUrl: string) {
  const response = await api.patch("/profile/avatar", { avatarUrl });
  return response.data.data;
}

export async function updateMyProfileData(payload: Record<string, any>) {
  const response = await api.patch("/profile/me", payload);
  return response.data.data;
}
