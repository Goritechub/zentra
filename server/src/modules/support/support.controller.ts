import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { SupportService } from "./support.service";

@Controller("support")
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post("complaints")
  createComplaint(
    @Body("subject") subject: string,
    @Body("category") category: string,
    @Body("message") message: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.supportService.createComplaint(subject, category, message, authorization);
  }

  @Get("complaints/mine")
  getMyComplaints(@Headers("authorization") authorization?: string) {
    return this.supportService.getMyComplaints(authorization);
  }

  @Get("chat")
  getSupportChat(@Headers("authorization") authorization?: string) {
    return this.supportService.getSupportChat(authorization);
  }

  @Post("chat/messages")
  sendSupportMessage(
    @Body("message") message: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.supportService.sendSupportMessage(message, authorization);
  }

  @Get("admin/settings")
  getAdminSettings(@Headers("authorization") authorization?: string) {
    return this.supportService.getAdminSettings(authorization);
  }

  @Patch("admin/settings")
  updateAdminSettings(
    @Body("email") email: string,
    @Body("phone") phone: string,
    @Body("whatsapp") whatsapp: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.supportService.updateAdminSettings(
      email,
      phone,
      whatsapp,
      authorization,
    );
  }

  @Get("admin/complaints")
  getAdminComplaints(
    @Query("status") status?: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.supportService.getAdminComplaints(status || "all", authorization);
  }

  @Patch("admin/complaints/:id/status")
  updateComplaintStatus(
    @Param("id") complaintId: string,
    @Body("status") status: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.supportService.updateComplaintStatus(
      complaintId,
      status,
      authorization,
    );
  }

  @Get("admin/chats")
  getAdminChats(@Headers("authorization") authorization?: string) {
    return this.supportService.getAdminChats(authorization);
  }

  @Get("admin/chats/:id/messages")
  getAdminChatMessages(
    @Param("id") chatId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.supportService.getAdminChatMessages(chatId, authorization);
  }

  @Post("admin/chats/:id/messages")
  sendAdminChatMessage(
    @Param("id") chatId: string,
    @Body("message") message: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.supportService.sendAdminChatMessage(chatId, message, authorization);
  }
}
