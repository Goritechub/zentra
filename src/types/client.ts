export interface BrowseContestClient {
  full_name: string | null;
}

export interface ContestSummary {
  id: string;
  title: string;
  description: string | null;
  status: string;
  category: string | null;
  deadline: string;
  banner_image: string | null;
  prize_first: number;
  prize_second: number | null;
  prize_third: number | null;
  prize_fourth: number | null;
  prize_fifth: number | null;
  client_id: string;
  review_message?: string | null;
  created_at: string;
  client?: BrowseContestClient | null;
  _entryCount: number;
  _winnersCount: number;
}

export interface SavedExpertFreelancerProfile {
  full_name: string | null;
  avatar_url: string | null;
  state: string | null;
  city: string | null;
}

export interface SavedExpertFreelancerDetails {
  title: string | null;
  rating: number | null;
  total_jobs_completed: number | null;
  skills: string[];
}

export interface SavedExpert {
  id: string;
  freelancer_id: string;
  created_at: string;
  freelancer: SavedExpertFreelancerProfile | null;
  freelancerProfile: SavedExpertFreelancerDetails | null;
}

export interface BrowseServiceFreelancer {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export interface BrowseService {
  id: string;
  freelancer_id: string;
  title: string;
  description: string | null;
  category: string | null;
  pricing_type: string;
  price: number | null;
  delivery_days: number | null;
  delivery_unit: string | null;
  revisions_allowed: number | null;
  skills: string[];
  images: string[];
  freelancer: BrowseServiceFreelancer | null;
  freelancer_rating: number | null;
  freelancer_jobs: number | null;
}

export interface BrowseFreelancerProfileInfo {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  state: string | null;
  city: string | null;
  occupation: string | null;
}

export interface BrowseFreelancer {
  id: string;
  user_id: string;
  title: string | null;
  bio: string | null;
  skills: string[];
  hourly_rate: number | null;
  years_experience: number | null;
  total_jobs_completed: number;
  rating: number;
  profile: BrowseFreelancerProfileInfo | null;
}

export interface ClientProfileInfo {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  state: string | null;
  city: string | null;
  is_verified: boolean;
  created_at: string;
  role: string;
}

export interface ClientKycInfo {
  kyc_status: string;
  verification_level: string;
  zentra_verified: boolean;
}

export interface ClientProfileJob {
  id: string;
  title: string;
  description: string | null;
  budget_min: number | null;
  budget_max: number | null;
  is_hourly: boolean;
  status: string;
  created_at: string;
}

export interface ClientProfileContest {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  banner_image: string | null;
  prize_first: number;
  prize_second: number | null;
  prize_third: number | null;
  prize_fourth: number | null;
  prize_fifth: number | null;
  status: string;
  deadline: string;
  created_at: string;
}

export interface ClientProfileReviewer {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  role: string;
}

export interface ClientProfileReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: ClientProfileReviewer | null;
  contract: { job_title: string | null } | null;
}

export interface ClientProfileStats {
  totalJobs: number;
  completedJobs: number;
  totalContests: number;
}

export interface ClientProfileOverview {
  profile: ClientProfileInfo;
  kyc: ClientKycInfo | null;
  jobs: ClientProfileJob[];
  contests: ClientProfileContest[];
  reviews: ClientProfileReview[];
  stats: ClientProfileStats;
}
