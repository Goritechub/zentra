import { Body, Controller, Delete, Get, Headers, Param, Post } from "@nestjs/common";
import { ClientReadService } from "./client-read.service";

@Controller()
export class ClientReadController {
  constructor(private readonly clientReadService: ClientReadService) {}

  @Get("contests/browse")
  getBrowseContests(@Headers("authorization") authorization?: string) {
    return this.clientReadService.getBrowseContests(authorization);
  }

  @Get("contests/mine")
  getMyContests(@Headers("authorization") authorization?: string) {
    return this.clientReadService.getMyContests(authorization);
  }

  @Get("saved-experts/mine")
  getSavedExperts(@Headers("authorization") authorization?: string) {
    return this.clientReadService.getSavedExperts(authorization);
  }

  @Delete("saved-experts/:id")
  removeSavedExpert(
    @Param("id") savedExpertId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.clientReadService.removeSavedExpert(savedExpertId, authorization);
  }

  @Get("experts/browse")
  getBrowseExperts(@Headers("authorization") authorization?: string) {
    return this.clientReadService.getBrowseExperts(authorization);
  }

  @Get("services/browse")
  getBrowseServices(@Headers("authorization") authorization?: string) {
    return this.clientReadService.getBrowseServices(authorization);
  }

  @Get("legal-documents/:slug")
  getPublishedLegalDocument(
    @Param("slug") slug: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.clientReadService.getPublishedLegalDocument(slug, authorization);
  }

  @Post("saved-experts")
  saveExpert(
    @Body("freelancerId") freelancerId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.clientReadService.saveExpert(freelancerId, authorization);
  }

  @Delete("saved-experts/by-freelancer/:id")
  removeSavedExpertByFreelancer(
    @Param("id") freelancerId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.clientReadService.removeSavedExpertByFreelancer(
      freelancerId,
      authorization,
    );
  }
}
