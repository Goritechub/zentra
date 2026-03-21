import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { ExpertReadService } from "./expert-read.service";

@Controller()
export class ExpertReadController {
  constructor(private readonly expertReadService: ExpertReadService) {}

  @Get("expert/skills/mine")
  getMySkills(@Headers("authorization") authorization?: string) {
    return this.expertReadService.getMySkills(authorization);
  }

  @Post("expert/skills/mine")
  saveMySkills(
    @Body("skills") skills?: string[],
    @Headers("authorization") authorization?: string,
  ) {
    return this.expertReadService.saveMySkills(skills || [], authorization);
  }

  @Get("experts/:id/profile-overview")
  getExpertProfileOverview(
    @Param("id") expertId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.expertReadService.getExpertProfileOverview(expertId, authorization);
  }
}
