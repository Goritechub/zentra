import { Module } from "@nestjs/common";
import { SharedModule } from "../shared/shared.module";
import { SupportController } from "./support.controller";
import { SupportService } from "./support.service";

@Module({
  imports: [SharedModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
