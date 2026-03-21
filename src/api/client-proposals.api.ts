import { api } from "./axios";

export async function getClientReceivedProposalsOverview() {
  const response = await api.get("/proposals/client-received-overview");
  return response.data.data;
}

export async function updateClientProposalStatus(proposalId: string, status: string) {
  const response = await api.patch(`/proposals/${proposalId}/status`, { status });
  return response.data.data;
}

export async function startClientProposalInterview(proposalId: string) {
  const response = await api.post(`/proposals/${proposalId}/interview`);
  return response.data.data as { proposalId: string; contractId: string };
}

export async function rejectClientProposal(proposalId: string) {
  const response = await api.post(`/proposals/${proposalId}/reject`);
  return response.data.data;
}

export async function acceptAndAssignClientProposal(proposalId: string, fundNow: boolean) {
  const response = await api.post(`/proposals/${proposalId}/assign`, { fundNow });
  return response.data.data as { contractId: string; status: string };
}
