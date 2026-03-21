import { Controller, Get, Headers } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("overview")
  getOverview(@Headers("authorization") authorization?: string) {
    return this.dashboardService.getOverview(authorization);
  }
}
