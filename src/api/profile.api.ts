import { api } from "./axios";
import type { UpdateProfilePayload, MyProfileOverview } from "@/types/profile";

export async function getMyProfileOverview() {
  const response = await api.get("/profile/me");
  return response.data.data as MyProfileOverview;
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

export async function updateMyProfileData(payload: UpdateProfilePayload) {
  const response = await api.patch("/profile/me", payload);
  return response.data.data;
}

export async function getPlatformReviewEligibility(): Promise<{ hasReviewed: boolean; completedContracts: number }> {
  const response = await api.get("/profile/platform-review/eligibility");
  return response.data.data;
}

export async function submitPlatformReview(rating: number, comment: string | null, completedContracts: number): Promise<void> {
  await api.post("/profile/platform-review", { rating, comment, completedContracts });
}
