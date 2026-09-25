import { api } from "./axios";
import type {
  ContestSummary,
  SavedExpert,
  BrowseService,
  BrowseFreelancer,
  ClientProfileOverview,
} from "@/types/client";

export interface BrowseContestsResponse {
  success: boolean;
  data: {
    contests: ContestSummary[];
  };
}

export interface MyContestsResponse {
  success: boolean;
  data: {
    contests: ContestSummary[];
  };
}

export interface SavedExpertsResponse {
  success: boolean;
  data: {
    savedExperts: SavedExpert[];
  };
}

export interface BrowseServicesResponse {
  success: boolean;
  data: {
    services: BrowseService[];
  };
}

export async function getBrowseContestsList() {
  const response = await api.get<BrowseContestsResponse>("/contests/browse");
  return response.data;
}

export async function getMyContestsList() {
  const response = await api.get<MyContestsResponse>("/contests/mine");
  return response.data;
}

export async function cancelContest(contestId: string, body?: { reason?: string; note?: string }) {
  const response = await api.patch(`/contests/${contestId}/cancel`, body ?? {});
  return response.data;
}

export async function resubmitContest(contestId: string, formData: FormData) {
  const response = await api.patch(`/contests/${contestId}/resubmit`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getSavedExpertsList() {
  const response = await api.get<SavedExpertsResponse>("/saved-experts/mine");
  return response.data;
}

export async function removeSavedExpert(savedExpertId: string) {
  const response = await api.delete(`/saved-experts/${savedExpertId}`);
  return response.data;
}

export async function getBrowseExpertsList() {
  const response = await api.get("/experts/browse");
  return response.data.data as {
    freelancers: BrowseFreelancer[];
    savedIds: string[];
    savedExperts: SavedExpert[];
  };
}

export async function saveExpert(freelancerId: string) {
  const response = await api.post("/saved-experts", { freelancerId });
  return response.data.data;
}

export async function removeSavedExpertByFreelancer(freelancerId: string) {
  const response = await api.delete(`/saved-experts/by-freelancer/${freelancerId}`);
  return response.data.data;
}

export async function getBrowseServicesList() {
  const response = await api.get<BrowseServicesResponse>("/services/browse");
  return response.data;
}

export type OtherService = Pick<
  BrowseService,
  "id" | "title" | "price" | "pricing_type" | "images" | "category"
>;

export interface PublicServiceResponse {
  success: boolean;
  data: BrowseService & {
    freelancer_rating: number | null;
    freelancer_jobs: number;
    other_services: OtherService[];
  };
}

export async function getPublicServiceById(serviceId: string) {
  const response = await api.get<PublicServiceResponse>(`/services/${serviceId}`);
  return response.data;
}

export async function getPublishedLegalDocument(slug: string) {
  const response = await api.get(`/legal-documents/${slug}`);
  return response.data.data as { document: { title: string; content: string } | null };
}

export async function getClientProfileOverview(clientId: string) {
  const response = await api.get(`/clients/${clientId}/profile-overview`);
  return response.data as {
    success: boolean;
    data: ClientProfileOverview;
  };
}

export interface PlatformSettingRow {
  key: string;
  value: unknown;
}

export async function getPublicPlatformSettings() {
  const response = await api.get("/platform-settings/public");
  return response.data.data as { settings: PlatformSettingRow[] };
}

export interface FeaturedTestimonial {
  rating: number;
  comment: string | null;
  user_id: string;
  is_featured: boolean;
  profiles: { full_name: string | null; avatar_url: string | null; city: string | null; state: string | null } | null;
}

export async function getFeaturedTestimonials() {
  const response = await api.get("/platform-reviews/featured");
  return response.data.data as { reviews: FeaturedTestimonial[] };
}

export interface FeaturedExpert {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  state: string | null;
  city: string | null;
  is_verified: boolean | null;
  title: string | null;
  rating: number | null;
  total_jobs_completed: number | null;
  hourly_rate: number | null;
  skills: string[] | null;
}

export async function getFeaturedExperts() {
  const response = await api.get("/experts/featured");
  return response.data.data as { experts: FeaturedExpert[] };
}

export async function lookupProfileNames(ids: string[]) {
  const response = await api.post("/profiles/lookup", { ids });
  return response.data.data as { profiles: { id: string; full_name: string | null }[] };
}
