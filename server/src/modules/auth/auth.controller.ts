import { Body, Controller, Get, Headers, Patch, Query } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("bootstrap")
  getBootstrap(@Headers("authorization") authorization?: string) {
    return this.authService.getBootstrap(authorization);
  }

  @Get("lookup")
  lookupUser(@Query("identifier") identifier?: string) {
    return this.authService.lookupUser(identifier);
  }

  @Patch("role")
  updateMyRole(
    @Body("role") role: "client" | "freelancer",
    @Headers("authorization") authorization?: string,
  ) {
    return this.authService.updateMyRole(role, authorization);
  }

  @Get("username-availability")
  getUsernameAvailability(
    @Query("username") username?: string,
    @Query("excludeUserId") excludeUserId?: string,
  ) {
    return this.authService.getUsernameAvailability(username, excludeUserId);
  }

  @Patch("profile/occupation")
  updateMyOccupation(
    @Body("occupation") occupation?: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.authService.updateMyOccupation(occupation, authorization);
  }

  @Patch("onboarding")
  completeOnboarding(
    @Body("role") role: "client" | "freelancer",
    @Body("username") username?: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.authService.completeOnboarding(role, username, authorization);
  }
}
