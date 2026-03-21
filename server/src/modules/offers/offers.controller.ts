import { Body, Controller, Get, Headers, Patch, Param, Post } from "@nestjs/common";
import { OffersService } from "./offers.service";

@Controller("offers")
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get("received")
  getReceivedOffers(@Headers("authorization") authorization?: string) {
    return this.offersService.getReceivedOffers(authorization);
  }

  @Get("sent")
  getSentOffers(@Headers("authorization") authorization?: string) {
    return this.offersService.getSentOffers(authorization);
  }

  @Patch("jobs/:id/cancel")
  cancelSentOfferJob(
    @Param("id") jobId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.offersService.cancelSentOfferJob(jobId, authorization);
  }

  @Post("decline")
  declineOffer(
    @Body("offerType") offerType: "direct_offer" | "job_offer",
    @Body("offerId") offerId: string | null,
    @Body("jobId") jobId: string | null,
    @Body("title") title: string | null,
    @Body("clientId") clientId: string | null,
    @Headers("authorization") authorization?: string,
  ) {
    return this.offersService.declineOffer(
      offerType,
      offerId,
      jobId,
      title,
      clientId,
      authorization,
    );
  }
}
