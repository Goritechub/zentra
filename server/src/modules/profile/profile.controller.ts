import { Body, Controller, Get, Headers, Patch } from "@nestjs/common";
import { ProfileService } from "./profile.service";

@Controller("profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get("me")
  getMyProfile(@Headers("authorization") authorization?: string) {
    return this.profileService.getMyProfile(authorization);
  }

  @Get("delete-checks")
  getDeleteChecks(@Headers("authorization") authorization?: string) {
    return this.profileService.getDeleteChecks(authorization);
  }

  @Patch("avatar")
  updateAvatar(
    @Body("avatarUrl") avatarUrl: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.profileService.updateAvatar(avatarUrl, authorization);
  }

  @Patch("me")
  updateMyProfile(
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.profileService.updateMyProfile(body, authorization);
  }
}
