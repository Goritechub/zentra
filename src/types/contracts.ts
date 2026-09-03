export interface ContractParty {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface ContractDetailData {
  id: string;
  client_id: string;
  freelancer_id: string;
  amount: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  job_title: string | null;
  job_description: string | null;
  job_category: string | null;
  job_budget_min: number | null;
  job_budget_max: number | null;
  job_delivery_days: number | null;
  job_delivery_unit: string | null;
  job_attachments: string[];
  accepted_cover_letter: string | null;
  accepted_bid_amount: number | null;
  accepted_attachments: string[];
  accepted_payment_type: string | null;
  terms_conditions: string | null;
  client: ContractParty | null;
  freelancer: ContractParty | null;
}

export interface ContractMilestone {
  id: string;
  contract_id: string;
  title: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  status: string;
  funded_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  submission_notes: string | null;
  submission_attachments: string[];
  duration_days: number | null;
  proposed_extension_date: string | null;
  created_at: string;
}

export interface ContractDispute {
  id: string;
  contract_id: string;
  milestone_id: string | null;
  raised_by: string;
  reason: string;
  evidence_urls: string[];
  status: string;
  dispute_status: string;
  admin_notes: string | null;
  respondent_id: string | null;
  respondent_explanation: string | null;
  respondent_evidence_urls: string[];
  response_deadline: string | null;
  adjudicator_id: string | null;
  adjudicator_assigned_at: string | null;
  resolution_type: string | null;
  resolution_explanation: string | null;
  resolution_split_client: number;
  resolution_split_freelancer: number;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface EscrowLedgerEntry {
  id: string;
  contract_id: string;
  milestone_id: string | null;
  held_amount: number;
  released_amount: number;
  platform_fee: number;
  expert_amount: number;
  status: string;
  created_at: string;
}

export interface WalletTransactionEntry {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  reference: string | null;
  description: string | null;
  contract_id: string | null;
  milestone_id: string | null;
  created_at: string;
}

export interface ContractActivityLogEntry {
  id: string;
  content: string;
  created_at: string;
}

export interface DisputeDetailResponse {
  dispute: ContractDispute;
  contract: ContractDetailData;
}

export interface MilestoneRecord {
  id: string;
  contract_id: string;
  title: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  status: string;
  funded_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  submission_notes: string | null;
  submission_attachments: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface DisputeAdjudicatorParty {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
}

export interface DisputeAdjudicatorContract {
  id: string;
  client_id: string;
  freelancer_id: string;
  amount: number;
  job_title: string | null;
  job_description: string | null;
  accepted_cover_letter: string | null;
  terms_conditions: string | null;
  client: DisputeAdjudicatorParty | null;
  freelancer: DisputeAdjudicatorParty | null;
}

export interface ContractDetailResponse {
  contract: ContractDetailData;
  milestones: ContractMilestone[];
  disputes: ContractDispute[];
  escrowLedger: EscrowLedgerEntry[];
  walletTransactions: WalletTransactionEntry[];
  activityLog: ContractActivityLogEntry[];
  hasReviewed: boolean;
  referralDiscount: boolean;
}

export interface AddMilestonePayload {
  title: string;
  description: string | null;
  amount: number;
  duration_days: number | null;
}

export interface SubmitReviewPayload {
  reviewee_id: string;
  rating: number;
  comment: string | null;
  rating_skills: number;
  rating_quality: number;
  rating_availability: number;
  rating_deadlines: number;
  rating_communication: number;
  rating_cooperation: number;
}
