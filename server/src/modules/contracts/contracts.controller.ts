import { Body, Controller, Get, Headers, Param, Patch } from "@nestjs/common";
import { ContractsService } from "./contracts.service";

@Controller("contracts")
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  getContracts(@Headers("authorization") authorization?: string) {
    return this.contractsService.getContracts(authorization);
  }

  @Get(":id/detail")
  getContractDetail(
    @Param("id") contractId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.contractsService.getContractDetail(contractId, authorization);
  }

  @Get("disputes/:id/detail")
  getDisputeDetail(
    @Param("id") disputeId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.contractsService.getDisputeDetail(disputeId, authorization);
  }

  @Patch("disputes/:id/respond")
  respondToDispute(
    @Param("id") disputeId: string,
    @Body("responseText") responseText: string,
    @Body("responseEvidenceUrls") responseEvidenceUrls: string[],
    @Headers("authorization") authorization?: string,
  ) {
    return this.contractsService.respondToDispute(
      disputeId,
      responseText,
      responseEvidenceUrls || [],
      authorization,
    );
  }

  @Patch(":id/milestones")
  addMilestone(
    @Param("id") contractId: string,
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.contractsService.addMilestone(contractId, body, authorization);
  }

  @Patch(":id/reviews")
  submitReview(
    @Param("id") contractId: string,
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.contractsService.submitReview(contractId, body, authorization);
  }
}
