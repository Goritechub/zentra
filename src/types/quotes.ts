export interface QuoteRequest {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  title: string;
  description: string;
  budget_min: number | null;
  budget_max: number | null;
  delivery_days: number | null;
  delivery_unit: string | null;
  category: string | null;
  skill_level: string | null;
  required_software: string[] | null;
  is_remote: boolean;
  attachments: string[] | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}
