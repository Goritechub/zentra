export interface WaitlistEntry {
  id: string;
  email: string;
  role: "client" | "expert";
  country: string;
  profession_or_skills: string;
  referral_source: string;
  project_description: string | null;
  created_at: string;
}
