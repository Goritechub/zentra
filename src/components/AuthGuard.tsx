import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { AuthCodeSetupGuard } from "@/components/AuthCodeSetupGuard";

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Wraps any route that requires authentication.
 * Guests are redirected to /auth with a ?redirect back.
 * Authenticated users without an auth code are forced to set one.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { user, profile, loading, profileLoading, isAdmin } = useAuth();
  const location = useLocation();

  // Only wait for session check, not profile
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // Admin users can only access admin routes — use user_roles as source of truth
  if (isAdmin && !location.pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  return <AuthCodeSetupGuard>{children}</AuthCodeSetupGuard>;
}
