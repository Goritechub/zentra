import { Controller, Get, Headers } from "@nestjs/common";
import { WalletService } from "./wallet.service";

@Controller("wallet")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get("overview")
  getOverview(@Headers("authorization") authorization?: string) {
    return this.walletService.getOverview(authorization);
  }

  @Get("balance")
  getBalance(@Headers("authorization") authorization?: string) {
    return this.walletService.getBalance(authorization);
  }
}
