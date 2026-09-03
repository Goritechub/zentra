export interface JobDetailsJob {
  id: string;
  client_id: string;
  status: string;
  title: string;
  description: string | null;
  created_at: string | null;
  budget_min: number | null;
  budget_max: number | null;
  is_remote: boolean | null;
  is_hourly: boolean | null;
  is_nda: boolean;
  nda_url: string | null;
  payment_type_preference: string | null;
  state: string | null;
  city: string | null;
  delivery_days: number | null;
  delivery_unit: string;
  attachments: string[] | null;
  skill_level: string | null;
  required_skills: string[] | null;
  required_software: string[] | null;
  visibility: string;
  invited_expert_ids: string[] | null;
  is_ip_policy: boolean;
  ip_policy_type: string | null;
  ip_policy_url: string | null;
  suggested_milestones: string[] | null;
}

export interface JobDetailsClient {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  state: string | null;
  city: string | null;
  is_verified: boolean;
}

export interface JobDetailsWallet {
  balance: number;
}

export interface JobProposalFreelancer {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  state: string | null;
  city: string | null;
  is_verified: boolean;
}

export interface JobProposalKyc {
  kyc_status: string;
  zentra_verified: boolean;
}

export interface JobProposalMilestone {
  title?: string;
  amount: number;
  duration?: number;
  duration_unit?: string;
  durationUnit?: string;
  date?: string;
}

export interface JobDetailsProposal {
  id: string;
  freelancer_id: string;
  freelancer: JobProposalFreelancer | null;
  kyc: JobProposalKyc | null;
  cover_letter: string | null;
  bid_amount: number;
  delivery_days: number | null;
  delivery_unit: string | null;
  payment_type: string;
  milestones: JobProposalMilestone[] | null;
  attachments: string[] | null;
  status: string;
  created_at: string;
}

export interface JobInterviewContractFreelancer {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  state: string | null;
  city: string | null;
}

export interface JobInterviewContract {
  id: string;
  proposal_id: string;
  freelancer_id: string;
  freelancer: JobInterviewContractFreelancer | null;
  amount: number;
  created_at: string;
}

export interface JobDetailsSimilarJob {
  id: string;
  title: string;
  budget_min: number | null;
  budget_max: number | null;
  is_hourly: boolean | null;
  is_remote: boolean | null;
  state: string | null;
  status: string;
}
