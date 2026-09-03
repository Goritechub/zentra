export interface DashboardJob {
  id: string;
  client_id: string;
  title: string;
  description: string;
  required_skills: string[] | null;
  required_software: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  is_hourly: boolean | null;
  delivery_days: number | null;
  delivery_unit: string;
  state: string | null;
  city: string | null;
  is_remote: boolean | null;
  status: string | null;
  attachments: string[] | null;
  created_at: string | null;
  updated_at: string | null;
  skill_level: string | null;
  visibility: string;
  invited_expert_ids: string[] | null;
  is_nda: boolean;
  nda_url: string | null;
  payment_ready: boolean;
  payment_type_preference: string | null;
  is_ip_policy: boolean;
  ip_policy_type: string | null;
  ip_policy_url: string | null;
  suggested_milestones: string[] | null;
}

export interface DashboardFreelancerProfile {
  id: string;
  user_id: string;
  title: string | null;
  bio: string | null;
  skills: string[] | null;
  hourly_rate: number | null;
  min_project_rate: number | null;
  years_experience: number | null;
  availability: string | null;
  rating: number | null;
  total_jobs_completed: number | null;
  show_whatsapp: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DashboardNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link_url: string | null;
  contract_id: string | null;
  created_at: string;
}

export interface DashboardOverview {
  stats: { jobs: number; proposals: number; messages: number; contracts: number };
  recentJobs: DashboardJob[];
  freelancerProfile: DashboardFreelancerProfile | null;
  isAdmin: boolean;
  walletBalance: number;
  completedContracts: number;
  recentActivity: DashboardNotification[];
  kyc: { kyc_status: string; verification_level: string; zentra_verified: boolean } | null;
}
