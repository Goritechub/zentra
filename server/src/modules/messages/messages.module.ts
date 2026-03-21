import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";

@Module({
  imports: [ConfigModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
