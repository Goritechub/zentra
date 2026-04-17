import { api } from "./axios";

export type JobOverview = {
  job: any;
  client: any | null;
  wallet: any | null;
  proposalCount: number;
  interviewingCount: number;
  hasApplied: boolean;
  myProposal: { id: string; status: string; notified_of_change: boolean } | null;
  proposals: any[];
  interviewContracts: any[];
  similarJobs: any[];
  clientStats: { totalJobs: number; hiredJobs: number; hireRate: number } | null;
  isSaved: boolean;
};

export async function getJobDetailsOverview(jobId: string): Promise<JobOverview> {
  const response = await api.get("/jobs/:id/overview", {
    headers: {
      "X-Job-Id": jobId,
    },
  });

  return response.data.data;
}
