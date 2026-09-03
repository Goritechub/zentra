import { api } from "./axios";
import type { ExpertProfileOverviewData } from "@/types/expert";

export interface ExpertSkillsResponse {
  success: boolean;
  data: {
    profileId: string | null;
    skills: string[];
  };
}

export interface ExpertProfileOverviewResponse {
  success: boolean;
  data: ExpertProfileOverviewData;
}

export async function getMyExpertSkills() {
  const response = await api.get<ExpertSkillsResponse>("/expert/skills/mine");
  return response.data;
}

export async function saveMyExpertSkills(skills: string[]) {
  const response = await api.post<ExpertSkillsResponse>("/expert/skills/mine", { skills });
  return response.data;
}

export async function getExpertProfileOverview(expertId: string) {
  const response = await api.get<ExpertProfileOverviewResponse>(`/experts/${expertId}/profile-overview`);
  return response.data;
}
