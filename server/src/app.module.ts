import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ProposalsModule } from "./modules/proposals/proposals.module";
import { OffersModule } from "./modules/offers/offers.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { MarketplaceModule } from "./modules/marketplace/marketplace.module";
import { ClientReadModule } from "./modules/client/client-read.module";
import { ExpertReadModule } from "./modules/expert/expert-read.module";
import { AdminReadModule } from "./modules/admin/admin-read.module";
import { SupportModule } from "./modules/support/support.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    AuthModule,
    JobsModule,
    ContractsModule,
    WalletModule,
    MessagesModule,
    NotificationsModule,
    ProposalsModule,
    OffersModule,
    DashboardModule,
    ProfileModule,
    MarketplaceModule,
    ClientReadModule,
    ExpertReadModule,
    AdminReadModule,
    SupportModule,
  ],
})
export class AppModule {}
