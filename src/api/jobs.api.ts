import { api } from "./axios";

export async function getOpenJobs() {
  const response = await api.get("/jobs");
  return response.data.data.jobs || [];
}

export async function getClientJobs() {
  const response = await api.get("/jobs/client");
  return response.data.data.jobs || [];
}

export async function getClientJobCancelState(jobId: string) {
  const response = await api.get(`/jobs/${jobId}/cancel-state`);
  return response.data.data as { hasAssignment: boolean; contractId: string | null };
}

export async function cancelClientJob(jobId: string) {
  const response = await api.patch(`/jobs/${jobId}/cancel`);
  return response.data.data;
}

export async function createClientJobDispute(jobId: string, reason: string) {
  const response = await api.post(`/jobs/${jobId}/disputes`, { reason });
  return response.data.data;
}

export async function searchInviteExperts(query: string) {
  const response = await api.get("/jobs/invite-experts", { params: { query } });
  return response.data.data.experts || [];
}

export async function createJobPost(payload: Record<string, any>) {
  const response = await api.post("/jobs", payload);
  return response.data.data;
}

export async function trackJobView(jobId: string) {
  const response = await api.post(`/jobs/${jobId}/views`);
  return response.data.data;
}
