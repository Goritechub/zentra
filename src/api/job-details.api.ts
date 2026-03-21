import { api } from "./axios";

export async function getJobDetailsOverview(jobId: string) {
  const response = await api.get("/jobs/:id/overview", {
    headers: {
      "X-Job-Id": jobId,
    },
  });

  return response.data.data;
}
