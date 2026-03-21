import { api } from "./axios";

export async function getReceivedOffers() {
  const response = await api.get("/offers/received");
  return response.data.data.offers || [];
}

export async function getSentOffers() {
  const response = await api.get("/offers/sent");
  return response.data.data as { offers: any[]; privateJobs: any[] };
}

export async function cancelSentOfferJob(jobId: string) {
  const response = await api.patch(`/offers/jobs/${jobId}/cancel`);
  return response.data.data;
}

export async function declineReceivedOffer(payload: {
  offerType: "direct_offer" | "job_offer";
  offerId: string | null;
  jobId: string | null;
  title: string | null;
  clientId: string | null;
}) {
  const response = await api.post("/offers/decline", payload);
  return response.data.data;
}
