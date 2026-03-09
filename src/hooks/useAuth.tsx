import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "client" | "freelancer" | "admin";

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
  role: UserRole;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, role: UserRole, fullName: string, username: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }

    return data as Profile;
  };

  useEffect(() => {
    let mounted = true;
    // Track the latest call so stale/overlapping fetches are discarded
    let latestCallId = 0;

    const loadUserAndProfile = async (s: Session | null) => {
      if (!mounted) return;
      const callId = ++latestCallId;
      console.log("[Auth] loadUserAndProfile called, hasSession:", !!s, "callId:", callId);

      if (s?.user) {
        // Retry profile fetch up to 2 times on failure (handles AbortError from concurrent calls)
        let profileData: Profile | null = null;
        let lastErr: unknown = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (!mounted || callId !== latestCallId) return; // stale call, abort
          try {
            profileData = await fetchProfile(s.user.id);
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            console.warn("[Auth] Profile fetch attempt", attempt + 1, "failed:", err);
            if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          }
        }

        if (!mounted || callId !== latestCallId) return; // stale call, abort

        if (lastErr) {
          console.error("[Auth] Profile fetch failed after retries:", lastErr);
        }

        console.log("[Auth] Profile loaded:", !!profileData, "setting user+profile+session, callId:", callId);
        setSession(s);
        setUser(s.user);
        setProfile(profileData);
      } else {
        console.log("[Auth] No session, clearing state");
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      if (mounted && callId === latestCallId) {
        console.log("[Auth] Setting loading=false, callId:", callId);
        setLoading(false);
      }
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        loadUserAndProfile(newSession);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      loadUserAndProfile(existingSession);
    });

    return () => {
      mounted = false;
      latestCallId++; // invalidate any in-flight calls
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, role: UserRole, fullName: string, username: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: role,
          username: username,
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

  const signOut = async () => {
    try {
      setUser(null);
      setSession(null);
      setProfile(null);
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Sign out error:", e);
    } finally {
      window.location.href = "/auth";
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
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
