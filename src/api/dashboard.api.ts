import { api } from "./axios";
import type { DashboardOverview } from "@/types/dashboard";

export async function getDashboardOverview() {
  const response = await api.get<{ success: boolean; data: DashboardOverview }>("/dashboard/overview");
  return response.data.data;
}
