import { api } from "./axios";
import type { ContractMessage } from "@/hooks/useContractMessages";

export async function getContracts() {
  const response = await api.get("/contracts");
  return response.data.data.contracts || [];
}

export async function getDisputeDetail(disputeId: string) {
  const response = await api.get(`/contracts/disputes/${disputeId}/detail`);
  return response.data.data as { dispute: any; contract: any };
}

export async function submitDisputeResponse(
  disputeId: string,
  responseText: string,
  responseEvidenceUrls: string[],
) {
  const response = await api.patch(`/contracts/disputes/${disputeId}/respond`, {
    responseText,
    responseEvidenceUrls,
  });
  return response.data.data;
}

export async function getContractDetail(contractId: string) {
  const response = await api.get(`/contracts/${contractId}/detail`);
  return response.data.data as {
    contract: any;
    milestones: any[];
    disputes: any[];
    escrowLedger: any[];
    walletTransactions: any[];
    activityLog: any[];
    hasReviewed: boolean;
  };
}

export async function addContractMilestone(contractId: string, payload: Record<string, any>) {
  const response = await api.patch(`/contracts/${contractId}/milestones`, payload);
  return response.data.data;
}

export async function submitContractReview(contractId: string, payload: Record<string, any>) {
  const response = await api.patch(`/contracts/${contractId}/reviews`, payload);
  return response.data.data;
}

export async function requestMilestoneExtension(milestoneId: string) {
  const response = await api.post(`/contracts/milestones/${milestoneId}/request-extension`);
  return response.data;
}

export async function respondMilestoneExpiry(milestoneId: string, action: "extend" | "cancel" | "ignore", newDueDate?: string) {
  const response = await api.post(`/contracts/milestones/${milestoneId}/respond-expiry`, { action, newDueDate });
  return response.data;
}

export async function respondMilestoneCancellation(milestoneId: string, action: "accept" | "reject") {
  const response = await api.post(`/contracts/milestones/${milestoneId}/respond-cancellation`, { action });
  return response.data;
}

export async function getContractMessages(contractId: string): Promise<ContractMessage[]> {
  const response = await api.get(`/contracts/${contractId}/messages`);
  return response.data.data.messages || [];
}

export async function sendContractMessage(
  contractId: string,
  content: string,
  attachments?: { url: string; name: string; type: string }[],
): Promise<void> {
  await api.post(`/contracts/${contractId}/messages`, {
    content,
    attachments: attachments || [],
  });
}
