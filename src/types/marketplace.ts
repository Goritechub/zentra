export interface MyServiceItem {
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
  banner_image: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ServicePayload {
  title: string;
  description: string;
  category: string | null;
  pricing_type: string;
  price: number | null;
  delivery_days: number | null;
  delivery_unit: string;
  revisions_allowed: number | null;
  skills: string[];
  images: string[];
  banner_image: string | null;
  is_active: boolean;
}

export interface PortfolioItem {
  id: string;
  freelancer_profile_id: string;
  title: string;
  description: string | null;
  project_type: string | null;
  software_used: string[];
  images: string[];
  created_at: string;
}

export interface MyContestEntryContest {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  status: string;
  prize_first: number;
  prize_second: number | null;
  prize_third: number | null;
  prize_fourth: number | null;
  prize_fifth: number | null;
  client_id: string;
  client: { full_name: string | null } | null;
}

export interface MyContestEntry {
  id: string;
  contest_id: string;
  freelancer_id: string;
  description: string | null;
  attachments: string[];
  is_winner: boolean;
  prize_position: number | null;
  edit_count: number;
  created_at: string;
  contest: MyContestEntryContest | null;
}

export interface ContestCommentLike {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
}

export interface ContestClient {
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  state: string | null;
  city: string | null;
}

export interface ContestDetailData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  category: string | null;
  deadline: string;
  prize_first: number;
  prize_second: number | null;
  prize_third: number | null;
  prize_fourth: number | null;
  prize_fifth: number | null;
  client_id: string;
  rules: string | null;
  banner_image: string | null;
  visibility: string;
  winner_selection_method: string | null;
  winner_justifications: Record<string, string> | null;
  deadline_extended_once: boolean;
  client: ContestClient | null;
}

export interface ContestEntryFreelancer {
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export interface ContestEntry {
  id: string;
  contest_id: string;
  freelancer_id: string;
  description: string | null;
  attachments: string[];
  is_winner: boolean;
  is_nominee: boolean;
  prize_position: number | null;
  edit_count: number;
  last_edited_at: string | null;
  created_at: string;
  freelancer: ContestEntryFreelancer | null;
}

export interface ContestParticipant {
  id: string;
  full_name: string | null;
  username: string | null;
}

export interface ContestCommentUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  role: string;
}

export interface ContestCommentRow {
  id: string;
  contest_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
}

export interface ContestComment extends ContestCommentRow {
  user: ContestCommentUser | null;
}

export interface UpdateContestEntryPayload {
  description: string;
  attachments: string[];
  edit_count: number;
  last_edited_at: string;
}
