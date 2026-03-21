import { Body, Controller, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { ProposalsService } from "./proposals.service";

@Controller("proposals")
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get("client-received-overview")
  getClientReceivedOverview(@Headers("authorization") authorization?: string) {
    return this.proposalsService.getClientReceivedOverview(authorization);
  }

  @Get("expert-overview")
  getExpertOverview(@Headers("authorization") authorization?: string) {
    return this.proposalsService.getExpertOverview(authorization);
  }

  @Get("jobs/:id/apply-context")
  getMyApplyContext(
    @Param("id") jobId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.proposalsService.getMyApplyContext(jobId, authorization);
  }

  @Post("jobs/:id/submit")
  submitMyProposal(
    @Param("id") jobId: string,
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.proposalsService.submitMyProposal(jobId, body, authorization);
  }

  @Patch(":id/mine")
  updateMyProposal(
    @Param("id") proposalId: string,
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.proposalsService.updateMyProposal(proposalId, body, authorization);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") proposalId: string,
    @Body("status") status: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.proposalsService.updateStatus(proposalId, status, authorization);
  }

  @Post(":id/interview")
  startInterview(
    @Param("id") proposalId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.proposalsService.startInterview(proposalId, authorization);
  }

  @Post(":id/reject")
  rejectProposal(
    @Param("id") proposalId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.proposalsService.rejectProposal(proposalId, authorization);
  }

  @Post(":id/assign")
  acceptAndAssign(
    @Param("id") proposalId: string,
    @Body("fundNow") fundNow: boolean,
    @Headers("authorization") authorization?: string,
  ) {
    return this.proposalsService.acceptAndAssign(proposalId, fundNow !== false, authorization);
  }
}
