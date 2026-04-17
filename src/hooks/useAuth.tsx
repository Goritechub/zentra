import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
  startTransition,
} from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAuthBootstrap, signOutUser } from "@/api/auth.api";

type UserRole = "client" | "freelancer" | "admin";
type BootstrapStatus = "loading" | "ready" | "unauthenticated" | "error";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  whatsapp: string | null;
  state: string | null;
  city: string | null;
  avatar_url: string | null;
  role: UserRole | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  auth_code_dismissed_at: string | null;
}

interface BootstrapPayload {
  user_id: string;
  profile_exists: boolean;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: UserRole | null;
  is_verified: boolean;
  created_at: string | null;
  updated_at: string | null;
  auth_code_dismissed_at: string | null;
  is_admin: boolean;
  onboarding_complete: boolean;
  state: string | null;
  city: string | null;
}

interface BootstrapCache {
  userId: string;
  profile: Profile | null;
  isAdmin: boolean;
  role: UserRole | null;
  onboardingComplete: boolean;
  cachedAt: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  isAdmin: boolean;
  role: UserRole | null;
  bootstrapStatus: BootstrapStatus;
  onboardingComplete: boolean;
  authError: string | null;
  signUp: (
    email: string,
    password: string,
    role: UserRole,
    fullName: string,
    username: string,
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => void;
  refreshProfile: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BOOTSTRAP_CACHE_KEY = "zentragig.bootstrap-cache";
const BOOTSTRAP_TIMEOUT_MS = 10000;

const authDebug = (...args: unknown[]) => {
  console.info("[auth]", ...args);
};

const mapBootstrapProfile = (
  user: User,
  payload: BootstrapPayload,
): Profile => ({
  id: payload.user_id,
  email: user.email || "",
  full_name: payload.full_name,
  username: payload.username,
  phone: null,
  whatsapp: null,
  state: payload.state,
  city: payload.city,
  avatar_url: payload.avatar_url,
  role: payload.role,
  is_verified: payload.is_verified,
  created_at: payload.created_at || new Date(0).toISOString(),
  updated_at: payload.updated_at || new Date(0).toISOString(),
  auth_code_dismissed_at: payload.auth_code_dismissed_at,
});

const readBootstrapCache = (userId: string): BootstrapCache | null => {
  try {
    const raw = window.localStorage.getItem(BOOTSTRAP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BootstrapCache;
    return parsed.userId === userId ? parsed : null;
  } catch {
    return null;
  }
};

const writeBootstrapCache = (cache: BootstrapCache | null) => {
  try {
    if (!cache) {
      window.localStorage.removeItem(BOOTSTRAP_CACHE_KEY);
      return;
    }
    window.localStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage failures.
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [bootstrapStatus, setBootstrapStatus] =
    useState<BootstrapStatus>("loading");
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lastBootstrapUserId, setLastBootstrapUserId] = useState<string | null>(
    null,
  );

  // Stable refs so the auth subscription effect never re-mounts just because
  // bootstrapStatus or lastBootstrapUserId changed. Without refs, every status
  // transition (e.g. "loading" → "ready") tears down and recreates the
  // onAuthStateChange listener, resets the in-flight guard, and fires a
  // getSession() that races the one already in flight — causing 2-3 redundant
  // bootstraps on admin login and the signout race that briefly restores user.
  const bootstrapStatusRef = useRef<BootstrapStatus>("loading");
  bootstrapStatusRef.current = bootstrapStatus;
  const lastBootstrapUserIdRef = useRef<string | null>(null);
  lastBootstrapUserIdRef.current = lastBootstrapUserId;

  const syncSessionOnly = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }, []);

  const applyBootstrapState = useCallback(
    (authUser: User, nextSession: Session, payload: BootstrapPayload) => {
      const mappedProfile = payload.profile_exists
        ? mapBootstrapProfile(authUser, payload)
        : null;
      const effectiveRole: UserRole | null = payload.is_admin
        ? "admin"
        : (payload.role ?? null);

      // Batch state updates to reduce re-renders
      startTransition(() => {
        setUser(authUser);
        setProfile(mappedProfile);
        setIsAdmin(payload.is_admin);
        setRole(effectiveRole);
        setOnboardingComplete(payload.onboarding_complete);
        setBootstrapStatus("ready");
        setAuthError(null);
        setLoading(false);
        setProfileLoading(false);
      });

      writeBootstrapCache({
        userId: authUser.id,
        profile: mappedProfile,
        isAdmin: payload.is_admin,
        role: effectiveRole,
        onboardingComplete: payload.onboarding_complete,
        cachedAt: Date.now(),
      });
    },
    [],
  );

  const applyCachedBootstrap = useCallback(
    (authUser: User, nextSession: Session, cached: BootstrapCache) => {
      setSession(nextSession);
      setUser(authUser);
      setProfile(
        cached.profile
          ? {
              ...cached.profile,
              email: authUser.email || cached.profile.email,
            }
          : null,
      );
      setIsAdmin(cached.isAdmin);
      setRole(cached.role);
      setOnboardingComplete(cached.onboardingComplete);
      setBootstrapStatus("ready");
      setAuthError(null);
      setLoading(false);
      setProfileLoading(false);
    },
    [],
  );

  const fetchBootstrapState = useCallback(
    async (userId: string, timeoutMs = BOOTSTRAP_TIMEOUT_MS) => {
      const startedAt = performance.now();
      const timedRpc = Promise.race([
        getAuthBootstrap().then((response) => {
          const backendUser = response.data.user;
          return {
            data: backendUser
              ? ({
                  user_id: backendUser.id,
                  profile_exists: true,
                  full_name: backendUser.fullName,
                  username: backendUser.username,
                  avatar_url: backendUser.avatarUrl,
                  role: backendUser.role,
                  is_verified: false,
                  created_at: null,
                  updated_at: null,
                  auth_code_dismissed_at: null,
                  is_admin: backendUser.isAdmin,
                  onboarding_complete: backendUser.onboardingComplete,
                  state: backendUser.state,
                  city: backendUser.city,
                } satisfies BootstrapPayload)
              : ({
                  user_id: userId,
                  profile_exists: false,
                  full_name: null,
                  username: null,
                  avatar_url: null,
                  role: null,
                  is_verified: false,
                  created_at: null,
                  updated_at: null,
                  auth_code_dismissed_at: null,
                  is_admin: false,
                  onboarding_complete: false,
                  state: null,
                  city: null,
                } satisfies BootstrapPayload),
            error: null,
          };
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("Account bootstrap timed out.")),
            timeoutMs,
          ),
        ),
      ]) as Promise<{ data: BootstrapPayload | null; error: Error | null }>;

      const { data, error } = await timedRpc;
      authDebug("bootstrap rpc resolved", {
        userId,
        durationMs: Math.round(performance.now() - startedAt),
        hasData: !!data,
        hasError: !!error,
      });
      if (error) throw error;
      if (!data) throw new Error("Account bootstrap returned no data.");
      return data;
    },
    [],
  );

  const clearAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setRole(null);
    setOnboardingComplete(false);
    setProfileLoading(false);
    setBootstrapStatus("unauthenticated");
    setAuthError(null);
    setLoading(false);
    writeBootstrapCache(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    let latestCallId = 0;
    let bootstrapInFlightForUser: string | null = null;

    const loadUserAndBootstrap = async (
      nextSession: Session | null,
      options?: { background?: boolean; force?: boolean },
    ) => {
      if (!mounted) return;
      const isBackgroundRefresh = !!options?.background;
      const forceRefresh = !!options?.force;

      if (!nextSession?.user) {
        const callId = ++latestCallId;
        authDebug("clearing auth state", { reason: "no_session" });
        clearAuthState();
        return;
      }

      const authUser = nextSession.user;
      const cached = readBootstrapCache(authUser.id);
      const sameUserAlreadyReady =
        !forceRefresh &&
        bootstrapStatusRef.current === "ready" &&
        lastBootstrapUserIdRef.current === authUser.id;

      if (sameUserAlreadyReady) {
        authDebug("bootstrap skipped", {
          callId: latestCallId,
          userId: authUser.id,
          reason: "same_user_already_ready",
          background: isBackgroundRefresh,
          hasCache: !!cached,
        });
        syncSessionOnly(nextSession);
        setLoading(false);
        setProfileLoading(false);
        return;
      }

      if (!forceRefresh && bootstrapInFlightForUser === authUser.id) {
        authDebug("bootstrap skipped", {
          callId: latestCallId,
          userId: authUser.id,
          reason: "bootstrap_already_in_flight",
          background: isBackgroundRefresh,
        });
        syncSessionOnly(nextSession);
        return;
      }

      const callId = ++latestCallId;
      const startedAt = performance.now();

      authDebug("bootstrap start", {
        callId,
        userId: authUser.id,
        background: isBackgroundRefresh,
        force: forceRefresh,
        hasCache: !!cached,
      });
      bootstrapInFlightForUser = authUser.id;

      setSession(nextSession);
      setUser(authUser);
      setAuthError(null);

      const hasAdminJwtClaim = authUser.app_metadata?.is_admin === true;

      if (!isBackgroundRefresh) {
        setProfileLoading(true);
        if (hasAdminJwtClaim && !cached && !forceRefresh) {
          // Fast path: JWT already tells us this is an admin — unblock the redirect
          // immediately and let the full bootstrap fill in the profile in the background.
          startTransition(() => {
            setIsAdmin(true);
            setRole("admin" as UserRole);
            setOnboardingComplete(true);
            setBootstrapStatus("ready");
            setLoading(false);
          });
        } else if (!cached || forceRefresh) {
          setLoading(true);
          setBootstrapStatus("loading");
        }
      }

      try {
        const payload = await fetchBootstrapState(authUser.id);
        if (!mounted || callId !== latestCallId) return;

        if (!payload.profile_exists && !payload.is_admin) {
          throw new Error("Your account profile is unavailable.");
        }

        applyBootstrapState(authUser, nextSession, payload);
        setLastBootstrapUserId(authUser.id);
        authDebug("bootstrap success", {
          callId,
          userId: authUser.id,
          durationMs: Math.round(performance.now() - startedAt),
          onboardingComplete: payload.onboarding_complete,
          role: payload.is_admin ? "admin" : payload.role,
        });
      } catch (error) {
        if (!mounted || callId !== latestCallId) return;

        const message =
          error instanceof Error
            ? error.message
            : "We could not refresh your account state.";
        authDebug("bootstrap failed", {
          callId,
          userId: authUser.id,
          durationMs: Math.round(performance.now() - startedAt),
          message,
          usedCache: !!cached,
        });

        if (cached) {
          applyCachedBootstrap(authUser, nextSession, cached);
          setLastBootstrapUserId(authUser.id);
          setAuthError(`${message} Using cached account data.`);
          return;
        }

        setProfile(null);
        setIsAdmin(false);
        setRole(null);
        setOnboardingComplete(false);
        setProfileLoading(false);
        setBootstrapStatus("error");
        setAuthError(message);
        setLoading(false);
      } finally {
        if (bootstrapInFlightForUser === authUser.id) {
          bootstrapInFlightForUser = null;
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, nextSession) => {
        authDebug("auth event", {
          event,
          hasSession: !!nextSession,
          userId: nextSession?.user?.id ?? null,
        });

        if (event === "TOKEN_REFRESHED" && nextSession?.user) {
          syncSessionOnly(nextSession);
          return;
        }

        if (event === "PASSWORD_RECOVERY") {
          // Just keep the session alive for the reset form — no profile bootstrap needed
          if (nextSession?.user) syncSessionOnly(nextSession);
          return;
        }

        if (event === "USER_UPDATED" && nextSession?.user) {
          syncSessionOnly(nextSession);
          void loadUserAndBootstrap(nextSession, {
            background: true,
            force: true,
          });
          return;
        }

        // Explicit SIGNED_OUT handling — clear state immediately instead of
        // falling through to loadUserAndBootstrap(null) which does the same
        // thing but less clearly.
        if (event === "SIGNED_OUT") {
          clearAuthState();
          return;
        }

        if (
          (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
          nextSession?.user
        ) {
          const sameUser =
            nextSession.user.id === lastBootstrapUserIdRef.current &&
            bootstrapStatusRef.current === "ready";
          if (sameUser) {
            authDebug("auth event short-circuited", {
              event,
              userId: nextSession.user.id,
              reason: "same_user_already_ready",
            });
            syncSessionOnly(nextSession);
            return;
          }
        }

        void loadUserAndBootstrap(nextSession);
      },
    );

    supabase.auth
      .getSession()
      .then(({ data: { session: existingSession } }) => {
        authDebug("initial getSession resolved", {
          hasSession: !!existingSession,
          userId: existingSession?.user?.id ?? null,
        });
        if (existingSession?.user) {
          const cached = readBootstrapCache(existingSession.user.id);
          if (cached) {
            applyCachedBootstrap(existingSession.user, existingSession, cached);
            setLastBootstrapUserId(existingSession.user.id);
            void loadUserAndBootstrap(existingSession, { background: true });
            return;
          }
        }

        void loadUserAndBootstrap(existingSession);
      });

    return () => {
      mounted = false;
      latestCallId++;
      subscription.unsubscribe();
    };
  }, [
    applyBootstrapState,
    applyCachedBootstrap,
    clearAuthState,
    fetchBootstrapState,
    syncSessionOnly,
  ]);

  // Cross-tab signout: when another tab removes the Supabase auth token from
  // localStorage (via our signOut()), clear auth state in this tab too.
  // The `storage` event only fires in tabs OTHER than the one that made the change.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key &&
        e.key.startsWith("sb-") &&
        e.key.endsWith("-auth-token") &&
        e.newValue === null
      ) {
        clearAuthState();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [clearAuthState]);

  const signUp = async (
    email: string,
    password: string,
    role: UserRole,
    fullName: string,
    username: string,
  ) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role,
          username,
        },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const signOut = () => {
    // 1. Fire backend invalidation first — the axios interceptor reads the token
    //    from localStorage, which is still present at this point.
    //    Fire-and-forget: we don't wait for the response because we're about to
    //    clear the token locally anyway. The backend call is a security bonus
    //    (global server-side revocation), not a gate for the local sign-out.
    signOutUser().catch(() => {});

    // 2. Clear admin session keys from sessionStorage so the next login always
    //    re-prompts for the auth code (sessionStorage survives same-tab navigation).
    if (user) {
      sessionStorage.removeItem(`zentragig.admin-verified.${user.id}`);
      sessionStorage.removeItem(`zentragig.admin-perms.${user.id}`);
    }

    // 3. Clear the bootstrap cache.
    writeBootstrapCache(null);

    // 4. Synchronously remove the Supabase auth token from localStorage so the
    //    page reload finds no session and getSession() returns null immediately.
    //    This is the critical step — without it the page reloads with the token
    //    still present and the auth flow bootstraps the user again before the
    //    async signOut round-trip completes.
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        window.localStorage.removeItem(key);
      }
    }

    // 5. Hard redirect. The session is gone from localStorage so getSession()
    //    on the fresh page load returns null → clearAuthState() → /auth stays put.
    window.location.href = "/auth";
  };

  const refreshProfile = async () => {
    if (!session?.user) return false;

    setProfileLoading(true);
    authDebug("manual refresh start", { userId: session.user.id });
    const retryDelaysMs = [0, 1200, 2500, 5000];
    let lastMessage = "We could not refresh your account state.";

    try {
      for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
        if (retryDelaysMs[attempt] > 0) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, retryDelaysMs[attempt]),
          );
        }

        try {
          const payload = await fetchBootstrapState(session.user.id, 12000);
          if (!payload.profile_exists && !payload.is_admin) {
            throw new Error("Your account profile is unavailable.");
          }

          applyBootstrapState(session.user, session, payload);
          setLastBootstrapUserId(session.user.id);
          authDebug("manual refresh success", {
            userId: session.user.id,
            onboardingComplete: payload.onboarding_complete,
            role: payload.is_admin ? "admin" : payload.role,
            attempts: attempt + 1,
          });
          return true;
        } catch (error) {
          lastMessage =
            error instanceof Error
              ? error.message
              : "We could not refresh your account state.";

          const canRetry =
            attempt < retryDelaysMs.length - 1 &&
            isRetryableBootstrapError(lastMessage);
          authDebug("manual refresh attempt failed", {
            userId: session.user.id,
            attempt: attempt + 1,
            message: lastMessage,
            willRetry: canRetry,
          });

          if (!canRetry) {
            throw error;
          }
        }
      }

      throw new Error(lastMessage);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not refresh your account state.";
      authDebug("manual refresh failed", {
        userId: session.user.id,
        message,
      });
      setAuthError(message);
      setProfileLoading(false);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileLoading,
        isAdmin,
        role,
        bootstrapStatus,
        onboardingComplete,
        authError,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
const isRetryableBootstrapError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("network error") ||
    normalized.includes("connection refused") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout")
  );
};
