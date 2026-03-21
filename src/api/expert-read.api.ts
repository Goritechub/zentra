import { api } from "./axios";

export interface ExpertSkillsResponse {
  success: boolean;
  data: {
    profileId: string | null;
    skills: string[];
  };
}

export interface ExpertProfileOverviewResponse {
  success: boolean;
  data: {
    profile: any;
    freelancerProfile: any;
    certifications: any[];
    workExperience: any[];
    services: any[];
    portfolio: any[];
    pastContracts: any[];
    completedContractCount: number;
    reviews: any[];
  };
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
