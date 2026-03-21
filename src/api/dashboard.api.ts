import { api } from "./axios";

export async function getDashboardOverview() {
  const response = await api.get("/dashboard/overview");
  return response.data.data;
}
