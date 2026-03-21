import { Body, Controller, Delete, Get, Headers, Param, Post } from "@nestjs/common";
import { MessagesService } from "./messages.service";

@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get("conversations")
  getConversations(@Headers("authorization") authorization?: string) {
    return this.messagesService.getConversations(authorization);
  }

  @Get("unread-count")
  getUnreadCount(@Headers("authorization") authorization?: string) {
    return this.messagesService.getUnreadCount(authorization);
  }

  @Post("conversations/hide")
  hideConversations(
    @Body("contractIds") contractIds: string[],
    @Headers("authorization") authorization?: string,
  ) {
    return this.messagesService.hideConversations(contractIds || [], authorization);
  }

  @Post("conversations/:id/hide")
  hideConversation(
    @Param("id") contractId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.messagesService.hideConversation(contractId, authorization);
  }

  @Delete("conversations/:id/hide")
  unhideConversation(
    @Param("id") contractId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.messagesService.unhideConversation(contractId, authorization);
  }
}
