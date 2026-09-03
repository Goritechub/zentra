import { api } from "./axios";
import type { QuoteRequest } from "@/types/quotes";

export interface QuoteRequestPayload {
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  title: string;
  description: string;
  budget_min?: number | null;
  budget_max?: number | null;
  delivery_days?: number | null;
  delivery_unit?: string | null;
  category?: string | null;
  skill_level?: string | null;
  required_software?: string[];
  is_remote?: boolean;
  attachments?: string[];
  recaptchaToken: string;
}

export async function uploadQuoteAttachments(files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const response = await api.post("/quotes/attachments", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data as { urls: string[] };
}

export async function createQuoteRequest(payload: QuoteRequestPayload) {
  const response = await api.post("/quotes", payload);
  return response.data.data as { id: string };
}

export async function getAdminQuotes(status?: string) {
  const response = await api.get("/admin/quotes", { params: status ? { status } : undefined });
  return response.data.data as { quotes: QuoteRequest[] };
}

export async function updateAdminQuoteStatus(id: string, body: { status?: string; admin_notes?: string }) {
  const response = await api.patch(`/admin/quotes/${id}/status`, body);
  return response.data.data;
}
