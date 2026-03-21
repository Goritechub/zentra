import { Controller, Get, Headers } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(@Headers("authorization") authorization?: string) {
    return this.notificationsService.getNotifications(authorization);
  }
}
