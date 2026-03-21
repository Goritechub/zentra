import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ContractsController } from "./contracts.controller";
import { ContractsService } from "./contracts.service";

@Module({
  imports: [ConfigModule],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
