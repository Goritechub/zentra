import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { JobsService } from "./jobs.service";

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  getOpenJobs(@Headers("authorization") authorization?: string) {
    return this.jobsService.getOpenJobs(authorization);
  }

  @Get("client")
  getClientJobs(@Headers("authorization") authorization?: string) {
    return this.jobsService.getClientJobs(authorization);
  }

  @Get("invite-experts")
  searchInviteExperts(
    @Query("query") query?: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.jobsService.searchInviteExperts(query || "", authorization);
  }

  @Post()
  createJob(
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.jobsService.createJob(body, authorization);
  }

  @Get(":id/cancel-state")
  getClientJobCancelState(
    @Param("id") jobId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.jobsService.getClientJobCancelState(jobId, authorization);
  }

  @Patch(":id/cancel")
  cancelClientJob(
    @Param("id") jobId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.jobsService.cancelClientJob(jobId, authorization);
  }

  @Post(":id/disputes")
  createJobDispute(
    @Param("id") jobId: string,
    @Body("reason") reason: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.jobsService.createJobDispute(jobId, reason, authorization);
  }

  @Get(":id/overview")
  getJobOverview(
    @Headers("authorization") authorization?: string,
    @Headers("x-job-id") jobId?: string,
  ) {
    return this.jobsService.getJobOverview(jobId, authorization);
  }

  @Post(":id/views")
  trackView(
    @Param("id") jobId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.jobsService.trackJobView(jobId, authorization);
  }
}
