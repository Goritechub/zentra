import { Module } from "@nestjs/common";
import { ExpertReadController } from "./expert-read.controller";
import { ExpertReadService } from "./expert-read.service";
import { SharedModule } from "../shared/shared.module";

@Module({
  imports: [SharedModule],
  controllers: [ExpertReadController],
  providers: [ExpertReadService],
})
export class ExpertReadModule {}
