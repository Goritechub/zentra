import { api } from "./axios";
import type {
  AdminReview,
  AdminPlatformReview,
  AdminJob,
  AdminContract,
  AdminMilestone,
  AdminEscrowEntry,
  AdminProposal,
  AdminContest,
  AdminContestCancellationRequest,
  AdminDispute,
  AdminActivityLog,
  AdminLegalDocument,
  AdminLegalDocumentInput,
  AdminVerification,
  AdminUserListItem,
  AdminUserWallet,
  AdminUserViolations,
  AdminCategory,
  AdminAccount,
  AdminPayoutTransfer,
  CommissionTier,
} from "@/types/admin";

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
  return response.data.data as { reviews: AdminReview[] };
}

export async function deleteAdminReview(reviewId: string) {
  const response = await api.delete(`/admin/reviews/${reviewId}`);
  return response.data.data;
}

export async function getAdminPlatformReviews() {
  const response = await api.get("/admin/platform-reviews");
  return response.data.data as { reviews: AdminPlatformReview[] };
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
  return response.data.data as { jobs: AdminJob[] };
}

export async function getAdminContractsData() {
  const response = await api.get("/admin/contracts");
  return response.data.data as { contracts: AdminContract[] };
}

export async function getAdminContractDetail(contractId: string) {
  const response = await api.get(`/admin/contracts/${contractId}`);
  return response.data.data as { contract: AdminContract; milestones: AdminMilestone[]; escrow: AdminEscrowEntry[] };
}

export async function deleteAdminContract(contractId: string) {
  const response = await api.delete(`/admin/contracts/${contractId}`);
  return response.data.data;
}

export async function getAdminJobProposals(jobId: string) {
  const response = await api.get(`/admin/jobs/${jobId}/proposals`);
  return response.data.data as { proposals: AdminProposal[] };
}

export async function deleteAdminJob(jobId: string) {
  const response = await api.delete(`/admin/jobs/${jobId}`);
  return response.data.data;
}

export async function getAdminContests() {
  const response = await api.get("/admin/contests");
  return response.data.data as { contests: AdminContest[] };
}

export async function getAdminPendingContests() {
  const response = await api.get("/admin/contests/pending-review");
  return response.data.data as { contests: AdminContest[] };
}

export async function approveAdminContest(contestId: string) {
  const response = await api.patch(`/admin/contests/${contestId}/approve`);
  return response.data.data;
}

export async function rejectAdminContest(contestId: string, message: string) {
  const response = await api.patch(`/admin/contests/${contestId}/reject`, { message });
  return response.data.data;
}

export async function getAdminCancellationRequests() {
  const response = await api.get("/admin/contests/cancellation-requests");
  return response.data.data as { requests: AdminContestCancellationRequest[] };
}

export async function approveAdminCancellationRequest(requestId: string) {
  const response = await api.patch(`/admin/contests/cancellation-requests/${requestId}/approve`);
  return response.data.data;
}

export async function rejectAdminCancellationRequest(requestId: string, message: string) {
  const response = await api.patch(`/admin/contests/cancellation-requests/${requestId}/reject`, { message });
  return response.data.data;
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

export async function completeAdminWithdrawal(withdrawalId: string) {
  const response = await api.patch(`/admin/payments/withdrawals/${withdrawalId}/complete`);
  return response.data.data;
}

export async function getAdminDashboardData() {
  const response = await api.get("/admin/dashboard");
  return response.data.data as {
    moderationLogs: Record<string, unknown>[];
    violators: Record<string, unknown>[];
    disputes: AdminDispute[];
  };
}

export async function getAdminActivityLogs() {
  const response = await api.get("/admin/activity");
  return response.data.data as { logs: AdminActivityLog[] };
}

export async function getAdminDisputesList() {
  const response = await api.get("/admin/disputes");
  return response.data.data as { disputes: AdminDispute[] };
}

export async function getAdminLegalDocuments() {
  const response = await api.get("/admin/legal-documents");
  return response.data.data as { documents: AdminLegalDocument[] };
}

export async function createAdminLegalDocument(payload: AdminLegalDocumentInput) {
  const response = await api.post("/admin/legal-documents", payload);
  return response.data.data as { document: AdminLegalDocument };
}

export async function updateAdminLegalDocument(documentId: string, payload: Partial<AdminLegalDocumentInput>) {
  const response = await api.patch(`/admin/legal-documents/${documentId}`, payload);
  return response.data.data as { document: AdminLegalDocument };
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
  return response.data.data as { verifications: AdminVerification[] };
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
    users: AdminUserListItem[];
    frozenWithdrawalUsers: Record<string, boolean>;
  };
}

export async function getAdminUserDetail(userId: string) {
  const response = await api.get(`/admin/users/${userId}`);
  return response.data.data as { wallet: AdminUserWallet | null; violations: AdminUserViolations | null };
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
  return response.data.data as { categories: AdminCategory[]; commissionTiers: CommissionTier[] };
}

export async function addAdminCategory(name: string, slug: string) {
  const response = await api.post("/admin/settings/categories", { name, slug });
  return response.data.data;
}

export async function updateAdminCommissionTiers(tiers: CommissionTier[]) {
  const response = await api.patch("/admin/settings/commission-tiers", { tiers });
  return response.data.data;
}

export async function listAdmins() {
  const response = await api.get("/admin/admins");
  return response.data.data.admins as AdminAccount[];
}

export async function createAdmin(payload: {
  email: string;
  password: string;
  fullName: string;
  permissions: string[];
  authCode: string;
}) {
  const response = await api.post("/admin/admins", payload);
  return response.data.data as { id: string };
}

export async function updateAdminPermissions(targetUserId: string, permissions: string[]) {
  const response = await api.patch(`/admin/admins/${targetUserId}/permissions`, { permissions });
  return response.data.data;
}

export async function removeAdmin(targetUserId: string) {
  const response = await api.delete(`/admin/admins/${targetUserId}`);
  return response.data.data;
}

export async function suspendAdmin(targetUserId: string, suspend: boolean) {
  const response = await api.patch(`/admin/admins/${targetUserId}/suspend`, { suspend });
  return response.data.data;
}

export async function resetAdminAuthCode(targetUserId: string, newCode: string) {
  const response = await api.patch(`/admin/admins/${targetUserId}/auth-code`, { newCode });
  return response.data.data;
}

export async function getAdminPendingWithdrawalCount() {
  const response = await api.get("/admin/payments/pending-count");
  return response.data.data as { count: number };
}

export async function getAdminPayoutTransfers() {
  const response = await api.get("/admin/payouts");
  return response.data.data as { transfers: AdminPayoutTransfer[] };
}

export async function retryAdminPayoutTransfer(transferId: string) {
  const response = await api.post(`/admin/payouts/${transferId}/retry`);
  return response.data.data;
}
