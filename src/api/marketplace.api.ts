import { api } from "./axios";
import type {
  MyServiceItem,
  ServicePayload,
  PortfolioItem,
  MyContestEntry,
  ContestCommentLike,
  ContestDetailData,
  ContestEntry,
  ContestParticipant,
  ContestComment,
  ContestCommentRow,
  UpdateContestEntryPayload,
} from "@/types/marketplace";

export interface MyServicesResponse {
  success: boolean;
  data: {
    services: MyServiceItem[];
  };
}

export interface MyContestEntriesResponse {
  success: boolean;
  data: {
    entries: MyContestEntry[];
  };
}

export interface MyPortfolioResponse {
  success: boolean;
  data: {
    profileId: string | null;
    items: PortfolioItem[];
  };
}

export async function getMyServicesList() {
  const response = await api.get<MyServicesResponse>("/services/mine");
  return response.data;
}

export async function getMyContestEntriesList() {
  const response = await api.get<MyContestEntriesResponse>("/contests/entries/mine");
  return response.data;
}

export async function getMyPortfolioOverview() {
  const response = await api.get<MyPortfolioResponse>("/portfolio/mine");
  return response.data;
}

export async function createMyPortfolioItem(payload: {
  title: string;
  description?: string | null;
  projectType?: string | null;
  softwareUsed?: string[];
  images?: string[];
}) {
  const response = await api.post("/portfolio/mine/items", payload);
  return response.data.data;
}

export async function deleteMyPortfolioItem(itemId: string) {
  const response = await api.delete(`/portfolio/mine/items/${itemId}`);
  return response.data.data;
}

export async function createMyService(payload: ServicePayload) {
  const response = await api.post("/services/mine", payload);
  return response.data.data;
}

export async function updateMyService(serviceId: string, payload: ServicePayload) {
  const response = await api.patch(`/services/mine/${serviceId}`, payload);
  return response.data.data;
}

export async function setMyServiceActive(serviceId: string, isActive: boolean) {
  const response = await api.patch(`/services/mine/${serviceId}/active`, { isActive });
  return response.data.data as { id: string; isActive: boolean };
}

export async function deleteMyService(serviceId: string) {
  const response = await api.delete(`/services/mine/${serviceId}`);
  return response.data.data;
}

export async function getContestFollowState(contestId: string) {
  const response = await api.get(`/contests/${contestId}/follow`);
  return response.data.data as { isFollowing: boolean };
}

export async function followContest(contestId: string) {
  const response = await api.post(`/contests/${contestId}/follow`);
  return response.data.data;
}

export async function unfollowContest(contestId: string) {
  const response = await api.delete(`/contests/${contestId}/follow`);
  return response.data.data;
}

export async function getContestFollowers(contestId: string) {
  const response = await api.get(`/contests/${contestId}/followers`);
  return response.data.data as { followers: Array<{ user_id: string }> };
}

export async function getContestCommentLikes(contestId: string) {
  const response = await api.get(`/contests/${contestId}/comment-likes`);
  return response.data.data as { likes: ContestCommentLike[] };
}

export async function toggleContestCommentLike(commentId: string, contestId: string) {
  const response = await api.post(`/contests/comments/${commentId}/likes/toggle`, { contestId });
  return response.data.data as { likes: ContestCommentLike[] };
}

export async function getContestDetailOverview(contestId: string) {
  const response = await api.get(`/contests/${contestId}/detail`);
  return response.data.data as {
    contest: ContestDetailData;
    trueEntryCount: number;
    entries: ContestEntry[];
    nominees: ContestEntry[];
    winners: ContestEntry[];
    participants: ContestParticipant[];
  };
}

export async function getContestComments(contestId: string) {
  const response = await api.get(`/contests/${contestId}/comments`);
  return response.data.data as { comments: ContestComment[] };
}

export async function createContestComment(
  contestId: string,
  payload: { content: string; parent_id?: string | null },
) {
  const response = await api.post(`/contests/${contestId}/comments`, payload);
  return response.data.data as { comment: ContestCommentRow };
}

export async function uploadEntryAttachments(files: File[]): Promise<string[]> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  const response = await api.post("/contests/entry-attachments", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return (response.data?.data?.urls as string[]) || [];
}

export async function submitContestEntry(contestId: string, payload: { description: string; attachments: string[] }) {
  const response = await api.post(`/contests/${contestId}/entries`, payload);
  return response.data.data;
}

export async function deleteContestEntry(entryId: string) {
  const response = await api.delete(`/contests/entries/${entryId}`);
  return response.data.data;
}

export async function updateContestEntry(entryId: string, payload: UpdateContestEntryPayload) {
  const response = await api.patch(`/contests/entries/${entryId}`, payload);
  return response.data.data as { entry: ContestEntry };
}

export async function setContestEntryNominee(entryId: string, isNominee: boolean) {
  const response = await api.patch(`/contests/entries/${entryId}/nominee`, { isNominee });
  return response.data.data as { id: string; isNominee: boolean };
}

export async function createCommentMention(commentId: string, mentionedUserId: string) {
  const response = await api.post(`/contests/comments/${commentId}/mentions`, { mentionedUserId });
  return response.data.data;
}

export async function updateContestStatus(contestId: string, status: string) {
  const response = await api.patch(`/contests/${contestId}/status`, { status });
  return response.data.data;
}

export async function updateContestWinnerJustifications(
  contestId: string,
  winnerJustifications: Record<string, string>,
) {
  const response = await api.patch(`/contests/${contestId}/winner-justifications`, {
    winnerJustifications,
  });
  return response.data.data as { id: string; winnerJustifications: Record<string, string> };
}

export async function extendContestDeadline(contestId: string, deadline: string) {
  const response = await api.patch(`/contests/${contestId}/deadline`, { deadline });
  return response.data.data as { id: string; deadline: string };
}

export async function publishContestWinners(contestId: string) {
  const response = await api.post(`/contests/${contestId}/publish-winners`);
  return response.data.data as { success: boolean };
}
