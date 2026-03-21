import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";

@Module({
  imports: [ConfigModule],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
