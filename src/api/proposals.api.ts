import { api } from "./axios";

export async function getExpertProposalsOverview() {
  const response = await api.get("/proposals/expert-overview");
  return response.data.data;
}

export async function getMyJobApplyContext(jobId: string) {
  const response = await api.get(`/proposals/jobs/${jobId}/apply-context`);
  return response.data.data as {
    job: any | null;
    existingProposal: any | null;
  };
}

export async function submitMyJobProposal(jobId: string, payload: Record<string, any>) {
  const response = await api.post(`/proposals/jobs/${jobId}/submit`, payload);
  return response.data.data as { proposal: any | null };
}

export async function updateMyJobProposal(proposalId: string, payload: Record<string, any>) {
  const response = await api.patch(`/proposals/${proposalId}/mine`, payload);
  return response.data.data as { proposal: any };
}
