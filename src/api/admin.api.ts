import { api } from "./axios";

export async function getAdminOverview() {
  const response = await api.get("/admin/overview");
  return response.data.data;
}

export async function getAdminPaymentsOverview() {
  const response = await api.get("/admin/payments");
  return response.data.data;
}

export async function getAdminReviews() {
  const response = await api.get("/admin/reviews");
  return response.data.data as { reviews: any[] };
}

export async function deleteAdminReview(reviewId: string) {
  const response = await api.delete(`/admin/reviews/${reviewId}`);
  return response.data.data;
}

export async function getAdminPlatformReviews() {
  const response = await api.get("/admin/platform-reviews");
  return response.data.data as { reviews: any[] };
}

export async function setAdminPlatformReviewApproval(reviewId: string, isApproved: boolean) {
  const response = await api.patch(`/admin/platform-reviews/${reviewId}/approval`, { isApproved });
  return response.data.data;
}

export async function setAdminPlatformReviewFeatured(reviewId: string, isFeatured: boolean) {
  const response = await api.patch(`/admin/platform-reviews/${reviewId}/featured`, { isFeatured });
  return response.data.data;
}

export async function deleteAdminPlatformReview(reviewId: string) {
  const response = await api.delete(`/admin/platform-reviews/${reviewId}`);
  return response.data.data;
}

export async function getAdminJobs() {
  const response = await api.get("/admin/jobs");
  return response.data.data as { jobs: any[] };
}

export async function getAdminContractsData() {
  const response = await api.get("/admin/contracts");
  return response.data.data as { contracts: any[] };
}

export async function getAdminContractDetail(contractId: string) {
  const response = await api.get(`/admin/contracts/${contractId}`);
  return response.data.data as { contract: any; milestones: any[]; escrow: any[] };
}

export async function deleteAdminContract(contractId: string) {
  const response = await api.delete(`/admin/contracts/${contractId}`);
  return response.data.data;
}

export async function getAdminJobProposals(jobId: string) {
  const response = await api.get(`/admin/jobs/${jobId}/proposals`);
  return response.data.data as { proposals: any[] };
}

export async function deleteAdminJob(jobId: string) {
  const response = await api.delete(`/admin/jobs/${jobId}`);
  return response.data.data;
}

export async function getAdminContests() {
  const response = await api.get("/admin/contests");
  return response.data.data as { contests: any[] };
}

export async function updateAdminContestStatus(contestId: string, status: string) {
  const response = await api.patch(`/admin/contests/${contestId}/status`, { status });
  return response.data.data;
}

export async function deleteAdminContest(contestId: string) {
  const response = await api.delete(`/admin/contests/${contestId}`);
  return response.data.data;
}

export async function setAdminWithdrawalsFreeze(frozen: boolean) {
  const response = await api.patch("/admin/payments/withdrawals-freeze", { frozen });
  return response.data.data as { frozen: boolean };
}

export async function cancelAdminWithdrawal(withdrawalId: string) {
  const response = await api.patch(`/admin/payments/withdrawals/${withdrawalId}/cancel`);
  return response.data.data;
}

export async function getAdminDashboardData() {
  const response = await api.get("/admin/dashboard");
  return response.data.data as {
    moderationLogs: any[];
    violators: any[];
    disputes: any[];
  };
}

export async function getAdminActivityLogs() {
  const response = await api.get("/admin/activity");
  return response.data.data as { logs: any[] };
}

export async function getAdminDisputesList() {
  const response = await api.get("/admin/disputes");
  return response.data.data as { disputes: any[] };
}

export async function getAdminLegalDocuments() {
  const response = await api.get("/admin/legal-documents");
  return response.data.data as { documents: any[] };
}

export async function createAdminLegalDocument(payload: Record<string, any>) {
  const response = await api.post("/admin/legal-documents", payload);
  return response.data.data as { document: any };
}

export async function updateAdminLegalDocument(documentId: string, payload: Record<string, any>) {
  const response = await api.patch(`/admin/legal-documents/${documentId}`, payload);
  return response.data.data as { document: any };
}

export async function deleteAdminLegalDocument(documentId: string) {
  const response = await api.delete(`/admin/legal-documents/${documentId}`);
  return response.data.data;
}

export async function setAdminUserSuspension(userId: string, suspended: boolean) {
  const response = await api.patch(`/admin/users/${userId}/suspension`, { suspended });
  return response.data.data as { userId: string; suspended: boolean };
}

export async function resolveAdminDispute(disputeId: string, status: string) {
  const response = await api.patch(`/admin/disputes/${disputeId}/resolve`, { status });
  return response.data.data as { id: string; status: string };
}

export async function getAdminVerifications() {
  const response = await api.get("/admin/verifications");
  return response.data.data as { verifications: any[] };
}

export async function approveAdminVerification(kycId: string) {
  const response = await api.patch(`/admin/verifications/${kycId}/approve`);
  return response.data.data;
}

export async function rejectAdminVerification(kycId: string, adminNotes: string) {
  const response = await api.patch(`/admin/verifications/${kycId}/reject`, { adminNotes });
  return response.data.data;
}

export async function grantAdminZentraVerification(kycId: string) {
  const response = await api.patch(`/admin/verifications/${kycId}/grant-zentra`);
  return response.data.data;
}

export async function revokeAdminZentraVerification(kycId: string) {
  const response = await api.patch(`/admin/verifications/${kycId}/revoke-zentra`);
  return response.data.data;
}

export async function revokeAdminIdentityVerification(kycId: string, adminNotes: string) {
  const response = await api.patch(`/admin/verifications/${kycId}/revoke-identity`, { adminNotes });
  return response.data.data;
}

export async function getAdminUsersData() {
  const response = await api.get("/admin/users");
  return response.data.data as {
    users: any[];
    frozenWithdrawalUsers: Record<string, boolean>;
  };
}

export async function getAdminUserDetail(userId: string) {
  const response = await api.get(`/admin/users/${userId}`);
  return response.data.data as { wallet: any; violations: any };
}

export async function setAdminUserVerification(userId: string, verified: boolean) {
  const response = await api.patch(`/admin/users/${userId}/verification`, { verified });
  return response.data.data;
}

export async function setAdminUserSuspensionUpsert(userId: string, suspended: boolean) {
  const response = await api.patch(`/admin/users/${userId}/suspension-upsert`, { suspended });
  return response.data.data;
}

export async function setAdminUserWithdrawalFreeze(userId: string, frozen: boolean, userName: string) {
  const response = await api.patch(`/admin/users/${userId}/withdrawal-freeze`, { frozen, userName });
  return response.data.data as { userId: string; frozen: boolean; frozenUsers: Record<string, boolean> };
}

export async function sendAdminUserWithdrawReminder(userId: string, walletBalance: number, escrowBalance: number) {
  const response = await api.post(`/admin/users/${userId}/withdraw-reminder`, { walletBalance, escrowBalance });
  return response.data.data;
}

export async function closeAdminUserAccount(userId: string) {
  const response = await api.post(`/admin/users/${userId}/close-account`);
  return response.data.data as { success?: boolean; code?: string; error?: string; wallet_balance?: number; escrow_balance?: number; active_contracts?: number };
}

export async function getAdminSettingsData() {
  const response = await api.get("/admin/settings");
  return response.data.data as { categories: any[]; commissionTiers: any[] };
}

export async function addAdminCategory(name: string, slug: string) {
  const response = await api.post("/admin/settings/categories", { name, slug });
  return response.data.data;
}

export async function updateAdminCommissionTiers(tiers: any[]) {
  const response = await api.patch("/admin/settings/commission-tiers", { tiers });
  return response.data.data;
}
