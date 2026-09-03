import { api } from "./axios";
import type {
  ApplyContextJob,
  ProposalRecord,
  SubmitProposalPayload,
  UpdateProposalPayload,
  ExpertProposalsOverview,
} from "@/types/proposals";

export async function getExpertPendingCounts() {
  const response = await api.get("/proposals/expert-pending-counts");
  return response.data.data as { pendingOffers: number; pendingInvites: number };
}

export async function getExpertProposalsOverview() {
  const response = await api.get("/proposals/expert-overview");
  return response.data.data as ExpertProposalsOverview;
}

export async function getMyJobApplyContext(jobId: string) {
  const response = await api.get(`/proposals/jobs/${jobId}/apply-context`);
  return response.data.data as {
    job: ApplyContextJob | null;
    existingProposal: ProposalRecord | null;
    referralDiscount: boolean;
    ipPolicyGated: boolean;
  };
}

export async function submitMyJobProposal(jobId: string, payload: SubmitProposalPayload) {
  const response = await api.post(`/proposals/jobs/${jobId}/submit`, payload);
  return response.data.data as { proposal: ProposalRecord | null };
}

export async function updateMyJobProposal(proposalId: string, payload: UpdateProposalPayload) {
  const response = await api.patch(`/proposals/${proposalId}/mine`, payload);
  return response.data.data as { proposal: ProposalRecord };
}

export async function withdrawMyJobProposal(proposalId: string) {
  const response = await api.post(`/proposals/${proposalId}/withdraw`);
  return response.data.data as { id: string; status: string };
}
