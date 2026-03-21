import { Module } from "@nestjs/common";
import { ClientReadController } from "./client-read.controller";
import { ClientReadService } from "./client-read.service";
import { SharedModule } from "../shared/shared.module";

@Module({
  imports: [SharedModule],
  controllers: [ClientReadController],
  providers: [ClientReadService],
})
export class ClientReadModule {}
