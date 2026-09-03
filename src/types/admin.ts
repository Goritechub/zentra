import type { CommissionTier } from "@/lib/service-charge";

export type { CommissionTier };

export interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: { full_name: string | null } | null;
  reviewee: { full_name: string | null } | null;
  contract: { job_title: string | null } | null;
}

export interface AdminPlatformReview {
  id: string;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  is_featured: boolean;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
}

export interface AdminJob {
  id: string;
  title: string;
  description: string | null;
  status: string;
  visibility: string;
  budget_min: number | null;
  budget_max: number | null;
  delivery_days: number | null;
  delivery_unit: string | null;
  created_at: string;
  client: { full_name: string | null; email: string } | null;
}

export interface AdminContract {
  id: string;
  job_title: string | null;
  amount: number;
  status: string;
  created_at: string;
  client: { full_name: string | null } | null;
  freelancer: { full_name: string | null } | null;
}

export interface AdminMilestone {
  id: string;
  title: string;
  status: string;
  amount: number;
}

export interface AdminEscrowEntry {
  id: string;
  status: string;
  held_amount: number;
  released_amount: number;
}

export interface AdminProposal {
  id: string;
  status: string;
  bid_amount: number;
  delivery_days: number | null;
  delivery_unit: string | null;
  freelancer: { full_name: string | null; email: string } | null;
}

export interface AdminContest {
  id: string;
  title: string;
  description?: string;
  status: string;
  category: string | null;
  deadline: string;
  prize_first: number;
  prize_second: number | null;
  prize_third: number | null;
  prize_fourth?: number | null;
  prize_fifth?: number | null;
  created_at: string;
  visibility: string;
  client_id: string;
  rules?: string | null;
  required_skills?: string[] | null;
  banner_image?: string | null;
  review_message?: string | null;
  reviewed_at?: string | null;
  profiles: { full_name: string | null; email: string; username: string | null; avatar_url?: string | null } | null;
  entry_count?: number;
  winner_count?: number;
}

export interface AdminContestCancellationRequest {
  id: string;
  status: string;
  reason: string;
  note?: string | null;
  created_at: string;
  contest: {
    id: string;
    title: string;
    status: string;
    prize_first: number;
    prize_second: number | null;
    prize_third: number | null;
    prize_fourth: number | null;
    prize_fifth: number | null;
    deadline: string;
    client_id: string;
  } | null;
  client: { full_name: string | null; email: string; username: string | null; avatar_url: string | null } | null;
  entry_count: number;
  client_wallet: { balance: number; escrow_balance: number; total_earned: number } | null;
  client_recent_transactions: Array<{
    amount: number;
    type: string;
    description: string;
    created_at: string;
  }>;
}

export interface AdminDispute {
  id: string;
  contract_id: string;
  milestone_id: string | null;
  status: string;
  dispute_status: string;
  reason: string;
  raised_by: string;
  respondent_id: string;
  respondent_explanation: string | null;
  evidence_urls: string[];
  respondent_evidence_urls: string[];
  response_deadline: string | null;
  adjudicator_id: string | null;
  adjudicator_assigned_at: string | null;
  resolution_type: string | null;
  resolution_explanation: string | null;
  resolution_split_client: number;
  resolution_split_freelancer: number;
  resolved_by: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  contract: {
    job_title: string | null;
    client: { full_name: string | null } | null;
    freelancer: { full_name: string | null } | null;
  } | null;
}

export interface AdminActivityLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminLegalDocument {
  id: string;
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  sort_order: number;
  updated_at: string;
}

export interface AdminLegalDocumentInput {
  title: string;
  slug: string;
  content: string;
  is_published: boolean;
  sort_order: number;
}

export interface AdminVerification {
  id: string;
  user_id: string;
  kyc_status: string;
  verification_level: string;
  zentra_verified: boolean;
  full_name_on_id: string | null;
  country: string | null;
  document_type: string | null;
  date_of_birth: string | null;
  kyc_provider_status: string | null;
  admin_notes: string | null;
  created_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    role: string;
    username: string | null;
  } | null;
}

export interface AdminUserListItem {
  id: string;
  full_name: string | null;
  email: string;
  username: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  whatsapp: string | null;
  is_verified: boolean;
  role: string;
  display_role: string;
  created_at: string;
}

export interface AdminUserWallet {
  balance: number;
  escrow_balance: number;
  total_earned: number;
  total_spent: number;
}

export interface AdminUserViolations {
  user_id: string;
  total_violations: number;
  is_suspended: boolean;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
}

export interface AdminAccount {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  permissions: string[];
  is_current_user: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
}

export interface AdminPayoutTransfer {
  id: string;
  amount: number;
  platform_fee: number;
  status: string;
  transfer_code: string | null;
  created_at: string;
  milestone: { title: string } | null;
  expert: { full_name: string; email: string } | null;
}
