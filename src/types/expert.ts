export interface ExpertProfileInfo {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  occupation: string | null;
  is_verified: boolean;
  role: string;
}

export interface ExpertKycInfo {
  kyc_status: string;
  verification_level: string;
  zentra_verified: boolean;
}

export interface ExpertFreelancerProfile {
  id: string;
  bio: string | null;
  title: string | null;
  skills: string[];
  hourly_rate: number | null;
  years_experience: number | null;
  availability: string | null;
  avg_response_time_hours: number | null;
}

export interface ExpertCertification {
  id: string;
  name: string;
  issuer: string | null;
  year_obtained: number | null;
  credential_url: string | null;
}

export interface ExpertWorkExperience {
  id: string;
  role: string;
  company: string;
  start_year: number;
  end_year: number | null;
  is_current: boolean;
  description: string | null;
}

export interface ExpertServiceOffer {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  pricing_type: string;
  category: string | null;
  delivery_days: number | null;
  delivery_unit: string | null;
  revisions_allowed: number | null;
}

export interface ExpertPortfolioItem {
  id: string;
  title: string;
  description: string | null;
  project_type: string | null;
  software_used: string[];
  images: string[];
}

export interface ExpertPastContractReview {
  rating: number;
  comment: string | null;
  reviewer_name: string | null;
}

export interface ExpertPastContract {
  id: string;
  job_title: string | null;
  job_description: string | null;
  job_category: string | null;
  amount: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  review: ExpertPastContractReview | null;
}

export interface ExpertReviewer {
  full_name: string | null;
  avatar_url: string | null;
}

export interface ExpertReviewContract {
  job_title: string | null;
}

export interface ExpertReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: ExpertReviewer | null;
  contract: ExpertReviewContract | null;
}

export interface ExpertProfileOverviewData {
  profile: ExpertProfileInfo;
  kyc: ExpertKycInfo | null;
  freelancerProfile: ExpertFreelancerProfile | null;
  certifications: ExpertCertification[];
  workExperience: ExpertWorkExperience[];
  services: ExpertServiceOffer[];
  portfolio: ExpertPortfolioItem[];
  pastContracts: ExpertPastContract[];
  completedContractCount: number;
  reviews: ExpertReview[];
}
