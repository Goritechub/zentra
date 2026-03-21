import { Module } from "@nestjs/common";
import { AdminReadController } from "./admin-read.controller";
import { AdminReadService } from "./admin-read.service";
import { SharedModule } from "../shared/shared.module";

@Module({
  imports: [SharedModule],
  controllers: [AdminReadController],
  providers: [AdminReadService],
})
export class AdminReadModule {}
