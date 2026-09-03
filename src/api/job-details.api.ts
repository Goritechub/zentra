import { api } from "./axios";
import type {
  JobDetailsJob,
  JobDetailsClient,
  JobDetailsWallet,
  JobDetailsProposal,
  JobInterviewContract,
  JobDetailsSimilarJob,
} from "@/types/job-details";

export type JobOverview = {
  job: JobDetailsJob;
  client: JobDetailsClient | null;
  wallet: JobDetailsWallet | null;
  proposalCount: number;
  interviewingCount: number;
  hasApplied: boolean;
  myProposal: { id: string; status: string; notified_of_change: boolean } | null;
  proposals: JobDetailsProposal[];
  interviewContracts: JobInterviewContract[];
  similarJobs: JobDetailsSimilarJob[];
  clientStats: { totalJobs: number; hiredJobs: number; hireRate: number } | null;
  isSaved: boolean;
  ipPolicyGated: boolean;
};

export async function getJobDetailsOverview(jobId: string): Promise<JobOverview> {
  const response = await api.get("/jobs/:id/overview", {
    headers: {
      "X-Job-Id": jobId,
    },
  });

  return response.data.data;
}
