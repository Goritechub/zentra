export interface UpdateProfileFreelancerData {
  title?: string | null;
  bio?: string | null;
  skills?: string[];
  hourly_rate?: number | null;
  min_project_rate?: number | null;
  years_experience?: number | null;
  availability?: string;
  show_whatsapp?: boolean;
}

export interface UpdateProfileCertification {
  id?: string;
  name: string;
  issuer?: string | null;
  year_obtained?: number | null;
  credential_url?: string | null;
}

export interface UpdateProfileWorkExperience {
  id?: string;
  company: string;
  role: string;
  start_year: number;
  end_year: number | null;
  is_current?: boolean;
  description?: string | null;
}

export interface ProfileEmailPreferences {
  transactional: boolean;
  messages: boolean;
  proposals: boolean;
  job_alerts: boolean;
  job_alert_mode: "instant" | "digest";
  contest_alerts: boolean;
  blog: boolean;
  platform_updates: boolean;
}

export interface MyProfileGeneralProfile {
  full_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  state: string | null;
  city: string | null;
  avatar_url: string | null;
  occupation: string | null;
  email_preferences: ProfileEmailPreferences | null;
}

export interface MyProfileEditFlags {
  full_name_edited: boolean;
  username_edited: boolean;
}

export interface MyProfileFreelancerProfile {
  id: string;
  user_id: string;
  title: string | null;
  bio: string | null;
  skills: string[] | null;
  hourly_rate: number | null;
  min_project_rate: number | null;
  years_experience: number | null;
  availability: "full_time" | "part_time" | "weekends" | "flexible" | null;
  show_whatsapp: boolean | null;
}

export interface MyProfileCertification {
  id: string;
  user_id: string;
  name: string;
  issuer: string | null;
  year_obtained: number | null;
  credential_url: string | null;
  created_at: string;
}

export interface MyProfileWorkExperience {
  id: string;
  user_id: string;
  company: string;
  role: string;
  start_year: number;
  end_year: number | null;
  is_current: boolean;
  description: string | null;
  created_at: string;
}

export interface MyProfileOverview {
  generalProfile: MyProfileGeneralProfile | null;
  editFlags: MyProfileEditFlags | null;
  freelancerProfile: MyProfileFreelancerProfile | null;
  certifications: MyProfileCertification[];
  workExperience: MyProfileWorkExperience[];
}

export interface UpdateProfilePayload {
  phone?: string | null;
  whatsapp?: string | null;
  state?: string | null;
  city?: string | null;
  occupation?: string | null;
  fullName?: string;
  fullNameEdited?: boolean;
  role?: string;
  freelancerProfileId?: string | null;
  freelancerData?: UpdateProfileFreelancerData;
  certifications?: UpdateProfileCertification[];
  workExperience?: UpdateProfileWorkExperience[];
  deletedCertIds?: string[];
  deletedExpIds?: string[];
  preferredCurrency?: "USD" | "NGN";
  emailPreferences?: ProfileEmailPreferences;
}
