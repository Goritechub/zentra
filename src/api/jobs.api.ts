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
  const response = await api.post("/jobs", payload, { timeout: 15000 });
  return response.data.data;
}

export async function trackJobView(jobId: string) {
  const response = await api.post(`/jobs/${jobId}/views`);
  return response.data.data;
}

export async function deleteClientJob(jobId: string): Promise<{ notified: number }> {
  const response = await api.delete(`/jobs/${jobId}`);
  return response.data.data;
}

export async function updateJobPost(jobId: string, payload: Record<string, any>) {
  const response = await api.patch(`/jobs/${jobId}`, payload, { timeout: 15000 });
  return response.data.data;
}

export async function getSavedJobIds(): Promise<string[]> {
  const response = await api.get("/jobs/saved-ids");
  return response.data.data.jobIds || [];
}

export async function agreeToJobIpPolicy(jobId: string) {
  const response = await api.post(`/jobs/${jobId}/ip-policy/agree`);
  return response.data.data;
}

export async function saveJob(jobId: string) {
  const response = await api.put(`/jobs/${jobId}/save`);
  return response.data;
}

export async function unsaveJob(jobId: string) {
  const response = await api.delete(`/jobs/${jobId}/save`);
  return response.data;
}
