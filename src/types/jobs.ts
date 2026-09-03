export interface JobPostPayload {
  title: string;
  description: string;
  budget_min: number | null;
  budget_max: number | null;
  delivery_days: number | null;
  delivery_unit: string;
  is_remote: boolean;
  is_hourly: boolean;
  state: string | null;
  city: string | null;
  required_skills: string[];
  required_software: string[];
  skill_level: string;
  attachments: string[] | null;
  visibility: string;
  invited_expert_ids: string[];
  is_nda: boolean;
  nda_url: string | null;
  is_ip_policy: boolean;
  ip_policy_type: string | null;
  ip_policy_url: string | null;
  payment_type_preference: string | null;
  suggested_milestones: string[] | null;
}
