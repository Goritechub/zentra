import { api } from "./axios";

export type BootstrapUserRole = "client" | "freelancer" | "admin" | null;

export interface AuthBootstrapResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      fullName: string | null;
      username: string | null;
      avatarUrl: string | null;
      role: BootstrapUserRole;
      onboardingComplete: boolean;
      isAdmin: boolean;
    } | null;
  };
}

export async function getAuthBootstrap() {
  const startedAt = performance.now();
  if (import.meta.env.DEV) {
    console.info("[auth-api] bootstrap request start");
  }

  try {
    const response = await api.get<AuthBootstrapResponse>("/auth/bootstrap");
    if (import.meta.env.DEV) {
      console.info("[auth-api] bootstrap request success", {
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[auth-api] bootstrap request failed", {
        durationMs: Math.round(performance.now() - startedAt),
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }
    throw error;
  }
}

export async function lookupAuthUser(identifier: string) {
  const response = await api.get("/auth/lookup", {
    params: { identifier },
  });
  return response.data.data as {
    found: boolean;
    email: string | null;
  };
}

export async function updateAuthRole(role: "client" | "freelancer") {
  const response = await api.patch("/auth/role", { role });
  return response.data.data as { role: "client" | "freelancer" };
}

export async function checkAuthUsernameAvailability(
  username: string,
  excludeUserId?: string,
) {
  const response = await api.get("/auth/username-availability", {
    params: { username, excludeUserId },
  });
  return response.data.data as { available: boolean; username: string | null };
}

export async function applyAuthOccupation(occupation: string) {
  const response = await api.patch("/auth/profile/occupation", { occupation });
  return response.data.data as { occupation: string | null };
}

export async function completeAuthOnboarding(input: {
  role: "client" | "freelancer";
  username: string;
}) {
  const response = await api.patch("/auth/onboarding", input);
  return response.data.data as { role: "client" | "freelancer"; username: string };
}
