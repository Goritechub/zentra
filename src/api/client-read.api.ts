import { api } from "./axios";

export interface BrowseContestsResponse {
  success: boolean;
  data: {
    contests: any[];
  };
}

export interface MyContestsResponse {
  success: boolean;
  data: {
    contests: any[];
  };
}

export interface SavedExpertsResponse {
  success: boolean;
  data: {
    savedExperts: any[];
  };
}

export interface BrowseServicesResponse {
  success: boolean;
  data: {
    services: any[];
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
    freelancers: any[];
    savedIds: string[];
    savedExperts: any[];
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

export async function getPublishedLegalDocument(slug: string) {
  const response = await api.get(`/legal-documents/${slug}`);
  return response.data.data as { document: { title: string; content: string } | null };
}
