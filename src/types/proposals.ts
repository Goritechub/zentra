import type { DashboardJob } from "./dashboard";

export type ApplyContextJob = DashboardJob;

export interface ProposalMilestone {
  title?: string;
  amount: number;
  duration?: number;
  duration_unit?: string;
  durationUnit?: string;
  date?: string;
}

export interface ProposalRecord {
  id: string;
  job_id: string;
  freelancer_id: string;
  bid_amount: number;
  delivery_days: number;
  delivery_unit: string;
  cover_letter: string;
  attachments: string[] | null;
  payment_type: string;
  milestones: ProposalMilestone[] | null;
  status: string | null;
  edit_count: number;
  last_edited_at: string | null;
  notified_of_change: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface SubmitProposalMilestoneInput {
  title: string;
  duration: number;
  duration_unit: string;
  amount: number;
}

export interface SubmitProposalPayload {
  bid_amount: number;
  delivery_days: number;
  delivery_unit: string;
  cover_letter: string;
  attachments?: string[];
  payment_type: string;
  milestones: SubmitProposalMilestoneInput[];
}

export interface UpdateProposalPayload extends SubmitProposalPayload {
  edit_count: number;
  last_edited_at: string;
}

export interface ExpertOverviewClient {
  full_name: string | null;
  avatar_url: string | null;
}

export interface ExpertOverviewProposalJob {
  id: string;
  title: string;
  client_id: string;
  budget_min: number | null;
  budget_max: number | null;
  is_hourly: boolean;
  status: string;
  client: ExpertOverviewClient | null;
}

export interface ExpertOverviewProposal extends ProposalRecord {
  job: ExpertOverviewProposalJob | null;
}

export interface ExpertOverviewOffer {
  id: string;
  client_id: string;
  freelancer_id: string;
  job_id: string | null;
  title: string;
  description: string | null;
  budget: number | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string | null;
  updated_at: string | null;
  client: ExpertOverviewClient | null;
}

export interface ExpertOverviewInvite {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  budget_min: number | null;
  budget_max: number | null;
  required_skills: string[] | null;
  created_at: string;
  client_id: string;
  client: ExpertOverviewClient | null;
}

export interface ExpertProposalsOverview {
  proposals: ExpertOverviewProposal[];
  offers: ExpertOverviewOffer[];
  invites: ExpertOverviewInvite[];
  interviewContracts: Record<string, string>;
}

export interface ClientReceivedWallet {
  balance: number;
}

export interface ClientReceivedJob {
  id: string;
  title: string;
  status: string;
  budget_min: number | null;
  budget_max: number | null;
  payment_type_preference: string | null;
  suggested_milestones: string[] | null;
}

export interface ClientReceivedProposalFreelancer {
  full_name: string | null;
  avatar_url: string | null;
  state: string | null;
  city: string | null;
  is_verified: boolean;
}

export interface ClientReceivedProposalKyc {
  user_id: string;
  kyc_status: string | null;
  zentra_verified: boolean | null;
}

export interface ClientReceivedProposal extends ProposalRecord {
  job_title: string;
  freelancer: ClientReceivedProposalFreelancer | null;
  kyc: ClientReceivedProposalKyc | null;
}

export interface ClientReceivedContract {
  id: string;
  job_id: string;
  status: string;
  freelancer_id: string;
}

export interface ClientReceivedProposalsOverview {
  wallet: ClientReceivedWallet | null;
  jobs: ClientReceivedJob[];
  proposals: ClientReceivedProposal[];
  jobContracts: ClientReceivedContract[];
}
