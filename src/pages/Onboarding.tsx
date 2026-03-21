import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { completeAuthOnboarding } from "@/api/auth.api";
import { Briefcase, Loader2, Users } from "lucide-react";

export default function OnboardingPage() {
  const { user, profile, loading, onboardingComplete, refreshProfile, role } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<"client" | "freelancer">(role === "freelancer" ? "freelancer" : "client");
  const [username, setUsername] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
      return;
    }

    if (!loading && onboardingComplete) {
      navigate(role === "freelancer" ? "/jobs" : "/dashboard", { replace: true });
    }
  }, [loading, navigate, onboardingComplete, role, user]);

  useEffect(() => {
    if (profile?.username) {
      setUsername(profile.username);
    }
    if (profile?.role === "freelancer") {
      setSelectedRole("freelancer");
      return;
    }
    const pendingRoleChoice = localStorage.getItem("pending_oauth_role_choice");
    if (pendingRoleChoice === "freelancer" || pendingRoleChoice === "client") {
      setSelectedRole(pendingRoleChoice);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const nextErrors: Record<string, string> = {};
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedUsername) {
      nextErrors.username = "Username is required";
    } else if (normalizedUsername.length < 3) {
      nextErrors.username = "Username must be at least 3 characters";
    } else if (normalizedUsername.length > 30) {
      nextErrors.username = "Username must be 30 characters or less";
    } else if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
      nextErrors.username = "Use only lowercase letters, numbers, and underscores";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrors({});

    let updatedProfile: { role: "client" | "freelancer"; username: string } | null = null;
    try {
      updatedProfile = await completeAuthOnboarding({
        role: selectedRole,
        username: normalizedUsername,
      });
    } catch (error: any) {
      const message = error?.response?.data?.message || "We could not finish your account setup. Please try again.";
      if (typeof message === "string" && message.toLowerCase().includes("username")) {
        setErrors({ username: "This username is already taken" });
      } else {
        setErrors({ general: message });
      }
      setSaving(false);
      return;
    }

    if (!updatedProfile || updatedProfile.role !== selectedRole || updatedProfile.username !== normalizedUsername) {
      setErrors({ general: "Your setup could not be completed yet. Please try again." });
      setSaving(false);
      return;
    }

    localStorage.removeItem("pending_oauth_role_choice");
    localStorage.removeItem("pending_oauth_ts");
    await refreshProfile();
    navigate(selectedRole === "freelancer" ? "/jobs" : "/dashboard", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-12 px-4">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-foreground">Complete your setup</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose how you want to use ZentraGig and reserve your username.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label>I want to...</Label>
                <RadioGroup
                  value={selectedRole}
                  onValueChange={(value: "client" | "freelancer") => setSelectedRole(value)}
                  className="grid grid-cols-2 gap-3"
                >
                  <label
                    htmlFor="onboarding-role-client"
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 cursor-pointer transition-all ${
                      selectedRole === "client" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <RadioGroupItem value="client" id="onboarding-role-client" className="sr-only" />
                    <Briefcase className={`h-6 w-6 ${selectedRole === "client" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`font-medium ${selectedRole === "client" ? "text-primary" : ""}`}>Client</span>
                    <span className="text-center text-xs text-muted-foreground">Hire engineering experts</span>
                  </label>
                  <label
                    htmlFor="onboarding-role-freelancer"
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 cursor-pointer transition-all ${
                      selectedRole === "freelancer" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <RadioGroupItem value="freelancer" id="onboarding-role-freelancer" className="sr-only" />
                    <Users className={`h-6 w-6 ${selectedRole === "freelancer" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`font-medium ${selectedRole === "freelancer" ? "text-primary" : ""}`}>Expert</span>
                    <span className="text-center text-xs text-muted-foreground">Offer technical services</span>
                  </label>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="onboarding-username">Username</Label>
                <Input
                  id="onboarding-username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                    if (errors.username) {
                      setErrors((prev) => {
                        const { username: _username, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  maxLength={30}
                  placeholder="your_username"
                  className={errors.username ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and underscores only. This will be your public username.
                </p>
                {errors.username && <p className="text-sm text-destructive">{errors.username}</p>}
              </div>

              {errors.general && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {errors.general}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
