import { api } from "./axios";

export interface HealthResponse {
  success: boolean;
  data: {
    status: "ok";
    service: string;
    timestamp: string;
  };
}

export async function getBackendHealth() {
  const response = await api.get<HealthResponse>("/health");
  return response.data;
}
