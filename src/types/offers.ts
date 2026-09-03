import type { DashboardJob } from "./dashboard";

export interface SentOfferFreelancer {
  full_name: string | null;
  avatar_url: string | null;
}

export interface SentOffer {
  id: string;
  client_id: string;
  freelancer_id: string;
  job_id: string | null;
  title: string;
  description: string | null;
  budget: number | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  freelancer: SentOfferFreelancer | null;
}

export type PrivateJob = DashboardJob;
