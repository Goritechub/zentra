import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { ZentraGigLogo } from "@/components/ZentraGigLogo";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const resetSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be less than 72 characters")
    .regex(/[A-Z]/, "Must include at least one uppercase letter")
    .regex(/[a-z]/, "Must include at least one lowercase letter")
    .regex(/[0-9]/, "Must include at least one number")
    .regex(/[^A-Za-z0-9]/, "Must include at least one special character"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const getPasswordStrength = (password: string) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { label: "Weak", color: "bg-destructive", width: "w-1/4" };
  if (score <= 3) return { label: "Fair", color: "bg-amber-500", width: "w-2/4" };
  if (score <= 4) return { label: "Good", color: "bg-accent", width: "w-3/4" };
  return { label: "Strong", color: "bg-primary", width: "w-full" };
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let settled = false;

    const settle = (recovery: boolean) => {
      if (settled) return;
      settled = true;
      setIsRecovery(recovery);
      setChecking(false);
    };

    // Listen for auth state changes — only treat PASSWORD_RECOVERY as valid
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settle(true);
      } else if (event === "SIGNED_OUT") {
        settle(false);
      }
      // Ignore INITIAL_SESSION / SIGNED_IN — the form must not show
      // until Supabase confirms this is a recovery session.
    });

    // Fallback: if PASSWORD_RECOVERY never fires within 5 s, check URL hash
    // as a last resort (covers edge cases where the event was emitted before
    // this component mounted).
    const timeout = setTimeout(() => {
      if (!settled) {
        const hash = window.location.hash;
        settle(hash.includes("type=recovery"));
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const fieldClass = (field: string) =>
    errors[field] ? "border-destructive focus-visible:ring-destructive" : "";

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = resetSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errs[err.path[0].toString()] = err.message;
      });
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        if (error.message.includes("same")) {
          setErrors({ password: "New password must be different from your current password" });
        } else {
          setErrors({ password: error.message });
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Redirect to dashboard after a brief delay
      setTimeout(() => navigate("/dashboard"), 3000);
    } catch {
      setErrors({ password: "An unexpected error occurred. Please try again." });
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying reset link…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <ZentraGigLogo size="lg" />
            </Link>
            <h1 className="text-2xl font-bold text-foreground">
              {success ? "Password Updated!" : "Set New Password"}
            </h1>
          </div>

          <div className="bg-card rounded-2xl border border-border p-8 shadow-card">
            {!isRecovery && !success ? (
              <div className="text-center space-y-4">
                <ShieldAlert className="h-12 w-12 mx-auto text-destructive" />
                <p className="text-muted-foreground text-sm">
                  This page is only accessible via a password reset link. Please request a reset from the sign-in page.
                </p>
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  Go to Sign In
                </Button>
              </div>
            ) : success ? (
              <div className="text-center space-y-4">
                <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
                <p className="text-muted-foreground text-sm">
                  Your password has been updated successfully. Redirecting you to your dashboard...
                </p>
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors((prev) => { const { password, ...rest } = prev; return rest; });
                      }}
                      className={cn("pr-10", fieldClass("password"))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && (() => {
                    const strength = getPasswordStrength(password);
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all duration-300", strength.color, strength.width)} />
                          </div>
                          <span className={cn(
                            "text-xs font-medium",
                            strength.label === "Weak" ? "text-destructive" :
                            strength.label === "Fair" ? "text-amber-500" :
                            strength.label === "Good" ? "text-accent" : "text-primary"
                          )}>
                            {strength.label}
                          </span>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          <li className={password.length >= 8 ? "text-primary" : ""}>
                            {password.length >= 8 ? "✓" : "○"} At least 8 characters
                          </li>
                          <li className={/[A-Z]/.test(password) ? "text-primary" : ""}>
                            {/[A-Z]/.test(password) ? "✓" : "○"} One uppercase letter
                          </li>
                          <li className={/[a-z]/.test(password) ? "text-primary" : ""}>
                            {/[a-z]/.test(password) ? "✓" : "○"} One lowercase letter
                          </li>
                          <li className={/[0-9]/.test(password) ? "text-primary" : ""}>
                            {/[0-9]/.test(password) ? "✓" : "○"} One number
                          </li>
                          <li className={/[^A-Za-z0-9]/.test(password) ? "text-primary" : ""}>
                            {/[^A-Za-z0-9]/.test(password) ? "✓" : "○"} One special character
                          </li>
                        </ul>
                      </div>
                    );
                  })()}
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) setErrors((prev) => { const { confirmPassword, ...rest } = prev; return rest; });
                      }}
                      className={cn("pr-10", fieldClass("confirmPassword"))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
