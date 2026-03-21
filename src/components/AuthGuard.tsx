import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  allowIncomplete?: boolean;
}

export function AuthGuard({ children, allowIncomplete = false }: AuthGuardProps) {
  const { user, loading, isAdmin, bootstrapStatus, authError, onboardingComplete } = useAuth();
  const location = useLocation();

  if (!user && (loading || bootstrapStatus === "loading")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || bootstrapStatus === "unauthenticated") {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (!user && bootstrapStatus === "error") {
    return <Navigate to={`/auth?error=${encodeURIComponent(authError || "auth_bootstrap_failed")}`} replace />;
  }

  if (!allowIncomplete && !onboardingComplete && !location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding" replace />;
  }

  if (isAdmin && !location.pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  if (allowIncomplete && !onboardingComplete) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
