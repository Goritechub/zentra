import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { AdminReadService } from "./admin-read.service";

@Controller("admin")
export class AdminReadController {
  constructor(private readonly adminReadService: AdminReadService) {}

  @Get("overview")
  getOverview(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getOverview(authorization);
  }

  @Get("payments")
  getPayments(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getPayments(authorization);
  }

  @Get("reviews")
  getReviews(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getReviews(authorization);
  }

  @Delete("reviews/:id")
  deleteReview(
    @Param("id") reviewId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.deleteReview(reviewId, authorization);
  }

  @Get("platform-reviews")
  getPlatformReviews(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getPlatformReviews(authorization);
  }

  @Patch("platform-reviews/:id/approval")
  setPlatformReviewApproval(
    @Param("id") reviewId: string,
    @Body("isApproved") isApproved: boolean,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.setPlatformReviewApproval(
      reviewId,
      isApproved,
      authorization,
    );
  }

  @Patch("platform-reviews/:id/featured")
  setPlatformReviewFeatured(
    @Param("id") reviewId: string,
    @Body("isFeatured") isFeatured: boolean,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.setPlatformReviewFeatured(
      reviewId,
      isFeatured,
      authorization,
    );
  }

  @Delete("platform-reviews/:id")
  deletePlatformReview(
    @Param("id") reviewId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.deletePlatformReview(reviewId, authorization);
  }

  @Get("jobs")
  getJobs(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getJobs(authorization);
  }

  @Get("contracts")
  getContracts(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getContracts(authorization);
  }

  @Get("contracts/:id")
  getContractDetail(
    @Param("id") contractId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.getContractDetail(contractId, authorization);
  }

  @Delete("contracts/:id")
  deleteContract(
    @Param("id") contractId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.deleteContract(contractId, authorization);
  }

  @Get("jobs/:id/proposals")
  getJobProposals(
    @Param("id") jobId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.getJobProposals(jobId, authorization);
  }

  @Delete("jobs/:id")
  deleteJob(
    @Param("id") jobId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.deleteJob(jobId, authorization);
  }

  @Get("contests")
  getContests(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getContests(authorization);
  }

  @Patch("contests/:id/status")
  updateContestStatus(
    @Param("id") contestId: string,
    @Body("status") status: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.updateContestStatus(contestId, status, authorization);
  }

  @Delete("contests/:id")
  deleteContest(
    @Param("id") contestId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.deleteContest(contestId, authorization);
  }

  @Patch("payments/withdrawals-freeze")
  setWithdrawalsFreeze(
    @Body("frozen") frozen: boolean,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.setWithdrawalsFreeze(frozen, authorization);
  }

  @Patch("payments/withdrawals/:id/cancel")
  cancelWithdrawal(
    @Param("id") withdrawalId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.cancelWithdrawal(withdrawalId, authorization);
  }

  @Get("dashboard")
  getDashboard(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getDashboard(authorization);
  }

  @Get("activity")
  getActivity(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getActivity(authorization);
  }

  @Get("disputes")
  getDisputes(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getDisputes(authorization);
  }

  @Get("legal-documents")
  getLegalDocuments(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getLegalDocuments(authorization);
  }

  @Post("legal-documents")
  createLegalDocument(
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.createLegalDocument(body, authorization);
  }

  @Patch("legal-documents/:id")
  updateLegalDocument(
    @Param("id") documentId: string,
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.updateLegalDocument(documentId, body, authorization);
  }

  @Delete("legal-documents/:id")
  deleteLegalDocument(
    @Param("id") documentId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.deleteLegalDocument(documentId, authorization);
  }

  @Patch("users/:id/suspension")
  setUserSuspension(
    @Param("id") userId: string,
    @Body("suspended") suspended: boolean,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.setUserSuspension(userId, suspended, authorization);
  }

  @Patch("disputes/:id/resolve")
  resolveDispute(
    @Param("id") disputeId: string,
    @Body("status") status: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.resolveDispute(disputeId, status, authorization);
  }

  @Get("verifications")
  getVerifications(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getVerifications(authorization);
  }

  @Patch("verifications/:id/approve")
  approveVerification(
    @Param("id") kycId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.approveVerification(kycId, authorization);
  }

  @Patch("verifications/:id/reject")
  rejectVerification(
    @Param("id") kycId: string,
    @Body("adminNotes") adminNotes: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.rejectVerification(kycId, adminNotes, authorization);
  }

  @Patch("verifications/:id/grant-zentra")
  grantZentraVerification(
    @Param("id") kycId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.grantZentraVerification(kycId, authorization);
  }

  @Patch("verifications/:id/revoke-zentra")
  revokeZentraVerification(
    @Param("id") kycId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.revokeZentraVerification(kycId, authorization);
  }

  @Patch("verifications/:id/revoke-identity")
  revokeIdentityVerification(
    @Param("id") kycId: string,
    @Body("adminNotes") adminNotes: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.revokeIdentityVerification(
      kycId,
      adminNotes,
      authorization,
    );
  }

  @Get("users")
  getUsers(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getUsers(authorization);
  }

  @Get("users/:id")
  getUserDetail(
    @Param("id") userId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.getUserDetail(userId, authorization);
  }

  @Patch("users/:id/verification")
  setUserVerification(
    @Param("id") userId: string,
    @Body("verified") verified: boolean,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.setUserVerification(userId, verified, authorization);
  }

  @Patch("users/:id/suspension-upsert")
  setUserSuspensionUpsert(
    @Param("id") userId: string,
    @Body("suspended") suspended: boolean,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.setUserSuspensionUpsert(
      userId,
      suspended,
      authorization,
    );
  }

  @Patch("users/:id/withdrawal-freeze")
  setUserWithdrawalFreeze(
    @Param("id") userId: string,
    @Body("frozen") frozen: boolean,
    @Body("userName") userName: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.setUserWithdrawalFreeze(
      userId,
      frozen,
      userName,
      authorization,
    );
  }

  @Post("users/:id/withdraw-reminder")
  sendWithdrawReminder(
    @Param("id") userId: string,
    @Body("walletBalance") walletBalance: number,
    @Body("escrowBalance") escrowBalance: number,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.sendWithdrawReminder(
      userId,
      walletBalance,
      escrowBalance,
      authorization,
    );
  }

  @Post("users/:id/close-account")
  closeUserAccount(
    @Param("id") userId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.closeUserAccount(userId, authorization);
  }

  @Get("settings")
  getSettings(@Headers("authorization") authorization?: string) {
    return this.adminReadService.getSettings(authorization);
  }

  @Post("settings/categories")
  addCategory(
    @Body("name") name: string,
    @Body("slug") slug: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.addCategory(name, slug, authorization);
  }

  @Patch("settings/commission-tiers")
  updateCommissionTiers(
    @Body("tiers") tiers: any[],
    @Headers("authorization") authorization?: string,
  ) {
    return this.adminReadService.updateCommissionTiers(tiers || [], authorization);
  }
}
