// Centralized error classification + logging so every page derives the same
// "what kind of failure is this" verdict instead of each hand-rolling its own
// substring checks (which drift out of sync, e.g. missing err.response/err.code).

export type ErrorKind = "network" | "server" | "not_found" | "unauthorized";

export function classifyError(error?: unknown): ErrorKind {
  if (!error) return "network";

  const err = error as { message?: string; code?: string; response?: { status?: number } };
  const status = err.response?.status;
  const msg = (err.message || "").toLowerCase();

  if (status === 401) return "unauthorized";
  if (status === 404) return "not_found";
  if (status && status >= 500) return "server";

  // No HTTP response at all (axios "Network Error", CORS block, DNS failure,
  // connection refused, timeout) — the request never reached a server.
  if (
    !status &&
    (err.code === "ERR_NETWORK" ||
      err.code === "ECONNABORTED" ||
      msg.includes("network") ||
      msg.includes("failed to fetch") ||
      msg.includes("connection"))
  ) {
    return "network";
  }

  if (msg.includes("unauthorized") || msg.includes("401")) return "unauthorized";
  if (msg.includes("not found") || msg.includes("404")) return "not_found";
  return "server";
}

export function logError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}
