import axios from "axios";
import { supabase } from "@/integrations/supabase/client";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const isDev = import.meta.env.DEV;

type SupabaseStoredSession = {
  access_token?: string;
  expires_at?: number;
};

export const getLocalStorageToken = (): string | null => {
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
      const session = (parsed as any)?.currentSession ?? parsed;
      const token = session?.access_token;
      // Use the token even if close to expiry — the 401 retry path handles refresh.
      if (token) return token;
    }
  } catch {
    // Ignore parse/storage errors and continue without a token.
  }

  return null;
};

// Singleton so concurrent 401s share one refresh rather than each calling refreshSession().
let pendingRefresh: Promise<string | null> | null = null;

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getLocalStorageToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
  async (error) => {
    if (isDev) {
      const method = (error?.config?.method || "GET").toUpperCase();
      const url = error?.config?.url || "";
      const status = error?.response?.status ?? null;
      console.error("[api] response error", { method, url, status, message: error?.message || "unknown_error" });
    }

    // On 401, attempt a one-time token refresh and retry the request.
    // Singleton prevents concurrent 401s from each calling refreshSession().
    if (error?.response?.status === 401 && !error.config?._retried) {
      try {
        if (!pendingRefresh) {
          pendingRefresh = supabase.auth
            .refreshSession()
            .then(({ data }) => data.session?.access_token || null)
            .catch(() => null)
            .finally(() => { pendingRefresh = null; });
        }
        const freshToken = await pendingRefresh;
        if (freshToken) {
          error.config._retried = true;
          error.config.headers.Authorization = `Bearer ${freshToken}`;
          return api.request(error.config);
        }
      } catch {
        // Refresh failed — fall through to error
      }
    }

    const message =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      "Request failed";

    return Promise.reject(new Error(message));
  },
);
