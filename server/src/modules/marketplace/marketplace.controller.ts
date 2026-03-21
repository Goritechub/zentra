import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { MarketplaceService } from "./marketplace.service";

@Controller()
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get("services/mine")
  getMyServices(@Headers("authorization") authorization?: string) {
    return this.marketplaceService.getMyServices(authorization);
  }

  @Get("contests/entries/mine")
  getMyContestEntries(@Headers("authorization") authorization?: string) {
    return this.marketplaceService.getMyContestEntries(authorization);
  }

  @Get("portfolio/mine")
  getMyPortfolio(@Headers("authorization") authorization?: string) {
    return this.marketplaceService.getMyPortfolio(authorization);
  }

  @Post("portfolio/mine/items")
  createPortfolioItem(
    @Body()
    body: {
      title?: string;
      description?: string | null;
      projectType?: string | null;
      softwareUsed?: string[];
      images?: string[];
    },
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.createPortfolioItem(body, authorization);
  }

  @Delete("portfolio/mine/items/:id")
  deletePortfolioItem(
    @Param("id") itemId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.deletePortfolioItem(itemId, authorization);
  }

  @Post("services/mine")
  createMyService(
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.createMyService(body, authorization);
  }

  @Patch("services/mine/:id")
  updateMyService(
    @Param("id") serviceId: string,
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.updateMyService(serviceId, body, authorization);
  }

  @Patch("services/mine/:id/active")
  setMyServiceActive(
    @Param("id") serviceId: string,
    @Body("isActive") isActive: boolean,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.setMyServiceActive(serviceId, isActive, authorization);
  }

  @Delete("services/mine/:id")
  deleteMyService(
    @Param("id") serviceId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.deleteMyService(serviceId, authorization);
  }

  @Get("contests/:id/follow")
  getContestFollowState(
    @Param("id") contestId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.getContestFollowState(contestId, authorization);
  }

  @Post("contests/:id/follow")
  followContest(
    @Param("id") contestId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.followContest(contestId, authorization);
  }

  @Delete("contests/:id/follow")
  unfollowContest(
    @Param("id") contestId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.unfollowContest(contestId, authorization);
  }

  @Get("contests/:id/followers")
  getContestFollowers(
    @Param("id") contestId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.getContestFollowers(contestId, authorization);
  }

  @Get("contests/:id/comment-likes")
  getContestCommentLikes(
    @Param("id") contestId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.getContestCommentLikes(contestId, authorization);
  }

  @Post("contests/comments/:id/likes/toggle")
  toggleContestCommentLike(
    @Param("id") commentId: string,
    @Body("contestId") contestId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.toggleContestCommentLike(commentId, contestId, authorization);
  }

  @Get("contests/:id/detail")
  getContestDetail(
    @Param("id") contestId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.getContestDetail(contestId, authorization);
  }

  @Get("contests/:id/comments")
  getContestComments(
    @Param("id") contestId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.getContestComments(contestId, authorization);
  }

  @Post("contests/:id/comments")
  createContestComment(
    @Param("id") contestId: string,
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.createContestComment(contestId, body, authorization);
  }

  @Post("contests/:id/entries")
  submitContestEntry(
    @Param("id") contestId: string,
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.submitContestEntry(contestId, body, authorization);
  }

  @Delete("contests/entries/:id")
  deleteContestEntry(
    @Param("id") entryId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.deleteContestEntry(entryId, authorization);
  }

  @Patch("contests/entries/:id")
  updateContestEntry(
    @Param("id") entryId: string,
    @Body() body: Record<string, any>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.updateContestEntry(entryId, body, authorization);
  }

  @Patch("contests/entries/:id/nominee")
  setContestEntryNominee(
    @Param("id") entryId: string,
    @Body("isNominee") isNominee: boolean,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.setContestEntryNominee(entryId, !!isNominee, authorization);
  }

  @Post("contests/comments/:id/mentions")
  createCommentMention(
    @Param("id") commentId: string,
    @Body("mentionedUserId") mentionedUserId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.createCommentMention(commentId, mentionedUserId, authorization);
  }

  @Patch("contests/:id/status")
  updateContestStatus(
    @Param("id") contestId: string,
    @Body("status") status: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.updateContestStatus(contestId, status, authorization);
  }

  @Patch("contests/:id/winner-justifications")
  updateContestWinnerJustifications(
    @Param("id") contestId: string,
    @Body("winnerJustifications") winnerJustifications: Record<string, string>,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.updateContestWinnerJustifications(
      contestId,
      winnerJustifications || {},
      authorization,
    );
  }

  @Patch("contests/:id/deadline")
  extendContestDeadline(
    @Param("id") contestId: string,
    @Body("deadline") deadline: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.extendContestDeadline(contestId, deadline, authorization);
  }

  @Post("contests/:id/publish-winners")
  publishContestWinners(
    @Param("id") contestId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.marketplaceService.publishContestWinners(contestId, authorization);
  }
}
