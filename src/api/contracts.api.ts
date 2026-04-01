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

export async function getContractMessages(contractId: string): Promise<ContractMessage[]> {
  const response = await api.get(`/contracts/${contractId}/messages`);
  return response.data.data.messages || [];
}

export async function sendContractMessage(
  contractId: string,
  content: string,
  files?: File[],
): Promise<void> {
  const form = new FormData();
  form.append("content", content);
  if (files?.length) {
    for (const file of files) form.append("files", file);
  }
  await api.post(`/contracts/${contractId}/messages`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
