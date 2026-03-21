import axios from "axios";
import { supabase } from "@/integrations/supabase/client";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const isDev = import.meta.env.DEV;
const SESSION_RESOLVE_TIMEOUT_MS = 1500;

type SupabaseStoredSession = {
  access_token?: string;
};

const getLocalStorageToken = (): string | null => {
  try {
    const explicitProjectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
    const preferredKey = explicitProjectRef ? `sb-${explicitProjectRef}-auth-token` : null;
    const keys = preferredKey
      ? [preferredKey]
      : Object.keys(window.localStorage).filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"));

    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SupabaseStoredSession | { currentSession?: SupabaseStoredSession };
      const token = parsed?.access_token || parsed?.currentSession?.access_token;
      if (token) return token;
    }
  } catch {
    // Ignore parse/storage errors and continue without a token.
  }

  return null;
};

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  const requestStartedAt = performance.now();
  const method = (config.method || "GET").toUpperCase();
  const url = config.url || "";

  if (isDev) {
    console.info("[api] request start", { method, url });
  }

  const sessionStartedAt = performance.now();

  let token = getLocalStorageToken();
  let tokenSource: "session" | "local_storage" | "none" = token ? "local_storage" : "none";

  // Avoid blocking every request on getSession when we already have a local token.
  if (!token) {
    try {
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("getSession timed out")), SESSION_RESOLVE_TIMEOUT_MS),
        ),
      ]);
      token = sessionResult.data.session?.access_token || null;
      tokenSource = token ? "session" : "none";
    } catch (error) {
      if (isDev) {
        console.warn("[api] auth session lookup failed", {
          method,
          url,
          durationMs: Math.round(performance.now() - sessionStartedAt),
          message: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }
  }

  if (isDev) {
    console.info("[api] auth session resolved", {
      method,
      url,
      durationMs: Math.round(performance.now() - sessionStartedAt),
      hasToken: !!token,
      tokenSource,
    });
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (isDev) {
    console.info("[api] request prepared", {
      method,
      url,
      durationMs: Math.round(performance.now() - requestStartedAt),
    });
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (isDev) {
      const method = (response.config.method || "GET").toUpperCase();
      const url = response.config.url || "";
      console.info("[api] response ok", { method, url, status: response.status });
    }
    return response;
  },
  (error) => {
    if (isDev) {
      const method = (error?.config?.method || "GET").toUpperCase();
      const url = error?.config?.url || "";
      const status = error?.response?.status ?? null;
      console.error("[api] response error", { method, url, status, message: error?.message || "unknown_error" });
    }

    const message =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      "Request failed";

    return Promise.reject(new Error(message));
  },
);
