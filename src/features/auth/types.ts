export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated" | "error";

export type AuthUserRole = "client" | "freelancer" | "admin" | null;

export interface AuthUser {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: AuthUserRole;
  onboardingComplete: boolean;
  isAdmin: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
}
