import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      success: true,
      data: {
        status: "ok",
        service: "zentragig-api",
        timestamp: new Date().toISOString(),
      },
    };
  }
}
