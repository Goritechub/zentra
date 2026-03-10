import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformFreeze } from "@/hooks/usePlatformFreeze";
import { toast } from "sonner";
import { Briefcase, Users, Loader2, CheckCircle2, Eye, EyeOff, Check, ShieldCheck } from "lucide-react";
import { ZentraGigLogo } from "@/components/ZentraGigLogo";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { TermsModal } from "@/components/TermsModal";

const RECAPTCHA_SITE_KEY = "6LdXjH4sAAAAAGq-ppkZ_-8z-nn2zUQFzXmb4YLW";

const fullNameValidator = z.string()
  .min(4, "Full name is too short")
  .max(100, "Full name is too long")
  .refine((val) => {
    const parts = val.trim().split(/\s+/).filter(p => p.length >= 2);
    return parts.length >= 2;
  }, "Please enter your first and last name (e.g. Adewale Okonkwo)")
  .refine((val) => /^[a-zA-ZÀ-ÿ\s'-]+$/.test(val.trim()), "Name should only contain letters, hyphens, and apostrophes");

const signUpSchema = z.object({
  fullName: fullNameValidator,
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  email: z.string().email("Please enter a valid email").max(255),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .regex(/[A-Z]/, "Must include at least one uppercase letter")
    .regex(/[a-z]/, "Must include at least one lowercase letter")
    .regex(/[0-9]/, "Must include at least one number")
    .regex(/[^A-Za-z0-9]/, "Must include at least one special character"),
  role: z.enum(["client", "freelancer"]),
});

const signInSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
});

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, signUp, signIn, loading: authLoading, profileLoading, refreshProfile } = useAuth();
  const { signupsPaused, platformFrozen } = usePlatformFreeze();

  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "signin";
  const defaultRole = searchParams.get("role") === "freelancer" ? "freelancer" : "client";

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const recaptchaWidgetIdRef = useRef<number | null>(null);
  const recaptchaScriptLoaded = useRef(false);
  const recaptchaRendering = useRef(false);

  const [signUpData, setSignUpData] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    role: defaultRole as "client" | "freelancer",
    occupation: "",
    occupationOther: "",
  });
  const [signUpErrors, setSignUpErrors] = useState<Record<string, string>>({});
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const [signInData, setSignInData] = useState({
    identifier: "",
    password: "",
  });
  const [signInErrors, setSignInErrors] = useState<Record<string, string>>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotErrors, setForgotErrors] = useState<Record<string, string>>({});
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Stable callbacks via refs to avoid stale closures
  const recaptchaTokenRef = useRef(recaptchaToken);
  recaptchaTokenRef.current = recaptchaToken;

  const onRecaptchaSuccess = useCallback((token: string) => {
    console.log("[reCAPTCHA] Token received:", token?.substring(0, 20) + "...");
    setRecaptchaToken(token);
  }, []);

  const onRecaptchaExpired = useCallback(() => {
    console.log("[reCAPTCHA] Token expired");
    setRecaptchaToken(null);
  }, []);

  // Load reCAPTCHA script only when signup tab is active
  useEffect(() => {
    if (activeTab !== "signup") return;
    if (recaptchaScriptLoaded.current) return;
    if (document.getElementById("recaptcha-v2-script")) {
      recaptchaScriptLoaded.current = true;
      return;
    }

    const script = document.createElement("script");
    script.id = "recaptcha-v2-script";
    script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      recaptchaScriptLoaded.current = true;
    };
    script.onerror = () => {
      console.error("[reCAPTCHA] Script failed to load");
    };
    document.head.appendChild(script);
  }, [activeTab]);

  // Render reCAPTCHA widget when signup tab is active
  useEffect(() => {
    if (activeTab !== "signup") return;

    const tryRender = () => {
      const grecaptcha = (window as any).grecaptcha;
      if (!grecaptcha?.render) return false;
      if (!recaptchaContainerRef.current) return false;
      if (recaptchaWidgetIdRef.current !== null) return true;
      if (recaptchaRendering.current) return false;

      recaptchaRendering.current = true;
      recaptchaContainerRef.current.innerHTML = "";

      try {
        const widgetId = grecaptcha.render(recaptchaContainerRef.current, {
          sitekey: RECAPTCHA_SITE_KEY,
          callback: onRecaptchaSuccess,
          "expired-callback": onRecaptchaExpired,
        });
        recaptchaWidgetIdRef.current = widgetId;
      } catch (err) {
        console.error("[reCAPTCHA] Render error:", err);
      } finally {
        recaptchaRendering.current = false;
      }
      return true;
    };

    if (tryRender()) return;

    const interval = setInterval(() => {
      if (tryRender()) clearInterval(interval);
    }, 300);

    return () => clearInterval(interval);
  }, [activeTab, onRecaptchaSuccess, onRecaptchaExpired]);

  // Reset when switching away from signup
  useEffect(() => {
    if (activeTab !== "signup" && recaptchaWidgetIdRef.current !== null) {
      const grecaptcha = (window as any).grecaptcha;
      if (grecaptcha) {
        try { grecaptcha.reset(recaptchaWidgetIdRef.current); } catch {}
      }
      setRecaptchaToken(null);
      recaptchaWidgetIdRef.current = null;
      if (recaptchaContainerRef.current) {
        recaptchaContainerRef.current.innerHTML = "";
      }
    }
  }, [activeTab]);

  // Fallback: if user exists but profile is null after auth completes, retry profile fetch
  useEffect(() => {
    if (user && !authLoading && !profile) {
      console.log("[Auth] User exists but profile is null, retrying profile fetch...");
      const timer = setTimeout(() => {
        refreshProfile();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, profile, refreshProfile]);

  // Apply pending occupation on first login
  useEffect(() => {
    if (!user || !profile) return;
    const pendingOccupation = localStorage.getItem("pending_occupation");
    if (!pendingOccupation) return;

    const apply = async () => {
      await supabase.from("profiles").update({ occupation: pendingOccupation } as any).eq("id", user.id);
      localStorage.removeItem("pending_occupation");
      refreshProfile();
    };
    apply();
  }, [user, profile, refreshProfile]);

  // Redirect once user exists and profile is loaded (or timed out)
  useEffect(() => {
    if (!user || authLoading) return;
    // Wait for profile to load before redirecting so we know the role
    if (profileLoading || !profile) return;

    const redirect = searchParams.get("redirect");
    if (redirect) {
      navigate(redirect);
      return;
    }

    const doRedirect = async () => {
      try {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (roleData) {
          navigate("/admin");
        } else if (profile.role === "freelancer") {
          navigate("/jobs");
        } else {
          navigate("/dashboard");
        }
      } catch {
        if (profile.role === "freelancer") {
          navigate("/jobs");
        } else {
          navigate("/dashboard");
        }
      }
    };
    doRedirect();
  }, [user, authLoading, profileLoading, profile, navigate, searchParams]);

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true);
    try {
      // Determine desired role: signup tab uses radio, signin tab uses URL param or default
      const desiredRole =
        activeTab === "signup" ? signUpData.role : searchParams.get("role") === "freelancer" ? "freelancer" : "client";

      // Store role + timestamp so we can detect new users after redirect
      localStorage.setItem("pending_oauth_role", desiredRole);
      localStorage.setItem("pending_oauth_ts", Date.now().toString());

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed. Please try again.");
        localStorage.removeItem("pending_oauth_role");
        localStorage.removeItem("pending_oauth_ts");
      }
    } catch (err: any) {
      toast.error("Google sign-in failed. Please try again.");
      localStorage.removeItem("pending_oauth_role");
      localStorage.removeItem("pending_oauth_ts");
    } finally {
      setGoogleLoading(false);
    }
  }, [activeTab, signUpData.role, searchParams]);

  // Robust post-OAuth role assignment
  useEffect(() => {
    const applyPendingRole = async () => {
      if (!user) return;

      const pendingRole = localStorage.getItem("pending_oauth_role") as "client" | "freelancer" | null;
      const pendingTs = localStorage.getItem("pending_oauth_ts");
      if (!pendingRole || !pendingTs) return;

      // Only process if the OAuth flow was recent (within 60 seconds)
      const elapsed = Date.now() - parseInt(pendingTs);
      if (elapsed > 60000) {
        localStorage.removeItem("pending_oauth_role");
        localStorage.removeItem("pending_oauth_ts");
        return;
      }

      // Poll for profile to exist (trigger may not have run yet)
      let profileData: any = null;
      for (let i = 0; i < 10; i++) {
        const { data } = await supabase
          .from("profiles")
          .select("id, role, created_at")
          .eq("id", user.id)
          .maybeSingle();
        if (data) {
          profileData = data;
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!profileData) {
        localStorage.removeItem("pending_oauth_role");
        localStorage.removeItem("pending_oauth_ts");
        return;
      }

      // Detect if this is a NEW user: profile created within the last 30 seconds
      const profileAge = Date.now() - new Date(profileData.created_at).getTime();
      const isNewUser = profileAge < 30000;

      if (isNewUser && profileData.role !== pendingRole) {
        // New user created with default role - update to intended role
        const { error } = await supabase
          .from("profiles")
          .update({ role: pendingRole })
          .eq("id", user.id);
        if (!error) {
          await refreshProfile();
        }
      }
      // Existing user: never override their role

      localStorage.removeItem("pending_oauth_role");
      localStorage.removeItem("pending_oauth_ts");
    };

    applyPendingRole();
  }, [user, refreshProfile]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupsPaused || platformFrozen) {
      toast.error(platformFrozen ? "The platform is currently under maintenance." : "New registrations are temporarily paused.");
      return;
    }
    setSignUpErrors({});

    const result = signUpSchema.safeParse(signUpData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0].toString()] = err.message;
      });
      if (!termsAccepted) errors.terms = "You must agree to the Terms and Conditions";
      setSignUpErrors(errors);
      return;
    }

    if (!termsAccepted) {
      setSignUpErrors({ terms: "You must agree to the Terms and Conditions" });
      return;
    }

    // Validate occupation word count (max 5 words for text inputs)
    const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
    if (signUpData.role === "client" && signUpData.occupation.trim() && wordCount(signUpData.occupation) > 5) {
      setSignUpErrors({ occupation: "Maximum 5 words allowed" });
      return;
    }
    if (signUpData.role === "freelancer" && signUpData.occupation === "Others") {
      if (!signUpData.occupationOther.trim()) {
        setSignUpErrors({ occupationOther: "Please specify your occupation" });
        return;
      }
      if (wordCount(signUpData.occupationOther) > 5) {
        setSignUpErrors({ occupationOther: "Maximum 5 words allowed" });
        return;
      }
    }

    setLoading(true);

    if (!recaptchaToken) {
      toast.error("Please complete the reCAPTCHA checkbox.");
      setLoading(false);
      return;
    }

    try {
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-recaptcha", {
        body: { token: recaptchaToken },
      });

      if (verifyError || !verifyData?.success) {
        toast.error(verifyData?.error || "reCAPTCHA verification failed. Please try again.");
        const grecaptcha = (window as any).grecaptcha;
        if (grecaptcha && recaptchaWidgetIdRef.current !== null) grecaptcha.reset(recaptchaWidgetIdRef.current);
        setRecaptchaToken(null);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("reCAPTCHA error:", err);
      toast.error("Security verification failed. Please refresh and try again.");
      setLoading(false);
      return;
    }

    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", signUpData.username)
      .maybeSingle();

    if (existingUser) {
      setSignUpErrors({ username: "This username is already taken" });
      setLoading(false);
      return;
    }

    const { error } = await signUp(
      signUpData.email,
      signUpData.password,
      signUpData.role,
      signUpData.fullName,
      signUpData.username,
    );

    // Store occupation to apply after first login (email verification required first)
    const finalOccupation = signUpData.role === "freelancer"
      ? (signUpData.occupation === "Others" ? signUpData.occupationOther.trim() : signUpData.occupation)
      : signUpData.occupation.trim();
    if (!error && finalOccupation) {
      localStorage.setItem("pending_occupation", finalOccupation);
    }

    if (error) {
      if (error.message.includes("already registered")) {
        setSignUpErrors({ email: "This email is already registered. Please sign in instead." });
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    setSignUpSuccess(true);
    const grecaptcha = (window as any).grecaptcha;
    if (grecaptcha && recaptchaWidgetIdRef.current !== null) {
      grecaptcha.reset(recaptchaWidgetIdRef.current);
    }
    setRecaptchaToken(null);
    setLoading(false);
  };

  const mapSignInError = (error: Error): { field?: string; message: string } => {
    const msg = error.message?.toLowerCase() || "";
    if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials"))
      return { field: "password", message: "Incorrect email or password." };
    if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed"))
      return { field: "identifier", message: "Please confirm your email before signing in." };
    if (msg.includes("too many requests") || msg.includes("rate limit") || msg.includes("429"))
      return { message: "Too many login attempts. Please wait a moment and try again." };
    if (msg.includes("user not found"))
      return { field: "identifier", message: "No account found with this email." };
    if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network"))
      return { message: "Network connection lost. Please check your internet and try again." };
    if (msg.includes("503") || msg.includes("service unavailable"))
      return { message: "Authentication service temporarily unavailable. Please try again shortly." };
    if (msg.includes("500") || msg.includes("server error"))
      return { message: "Server error. Please try again shortly." };
    if (msg.includes("403") || msg.includes("forbidden"))
      return { message: "Your account is restricted. Please contact support." };
    return { message: "Something went wrong during sign-in. Please try again." };
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInErrors({});

    // Check network before attempting
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSignInErrors({ general: "Network connection lost. Please check your internet and try again." });
      return;
    }

    const result = signInSchema.safeParse(signInData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0].toString()] = err.message;
      });
      setSignInErrors(errors);
      return;
    }

    setLoading(true);

    try {
      // Username lookup with timeout
      let email = signInData.identifier;
      if (!signInData.identifier.includes("@")) {
        const lookupPromise = supabase
          .from("profiles")
          .select("email")
          .eq("username", signInData.identifier)
          .single();

        const lookupResult = await Promise.race([
          lookupPromise,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 10000)),
        ]);

        const { data: profileData, error: lookupError } = lookupResult as any;
        if (lookupError || !profileData) {
          setSignInErrors({ identifier: "No account found with that username" });
          setLoading(false);
          return;
        }
        email = profileData.email;
      }

      // Sign in with timeout
      const signInPromise = signIn(email, signInData.password);
      const { error } = await Promise.race([
        signInPromise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 10000)),
      ]);

      if (error) {
        const mapped = mapSignInError(error);
        if (mapped.field) {
          setSignInErrors({ [mapped.field]: mapped.message });
        } else {
          setSignInErrors({ general: mapped.message });
        }
        setLoading(false);
        return;
      }

      setLoading(false);
      toast.success("Welcome back!");
    } catch (err: any) {
      console.error("Sign-in error:", err);
      if (err?.message === "TIMEOUT") {
        setSignInErrors({ general: "Connection timed out. Please check your internet connection and try again." });
      } else if (err?.message?.toLowerCase().includes("fetch") || err?.message?.toLowerCase().includes("network")) {
        setSignInErrors({ general: "Network connection lost. Please check your internet and try again." });
      } else {
        setSignInErrors({ general: "Something went wrong during sign-in. Please try again." });
      }
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrors({});

    const result = forgotPasswordSchema.safeParse({ identifier: forgotEmail });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0].toString()] = err.message;
      });
      setForgotErrors(errors);
      return;
    }

    setForgotLoading(true);

    const input = forgotEmail.trim();
    let email = input;

    // If input doesn't look like an email, treat as username
    if (!input.includes("@")) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("email")
        .eq("username", input)
        .maybeSingle();

      if (!profileData) {
        setForgotErrors({ identifier: "No account found with this username" });
        setForgotLoading(false);
        return;
      }
      email = profileData.email;
    } else {
      // Verify email exists
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", input.toLowerCase())
        .maybeSingle();

      if (!profileData) {
        setForgotErrors({ identifier: "No account found with this email address" });
        setForgotLoading(false);
        return;
      }
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setForgotErrors({ identifier: error.message });
      setForgotLoading(false);
      return;
    }

    setForgotSuccess(true);
    setForgotLoading(false);
  };

  // Only show loading spinner if we already have a user (redirecting)
  // Unauthenticated users should see the form immediately
  if (authLoading && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const GoogleButton = ({ label }: { label: string }) => (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      size="lg"
      disabled={googleLoading || loading}
      onClick={handleGoogleSignIn}
    >
      {googleLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      )}
      {label}
    </Button>
  );

  // Password strength calculator
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

  const passwordStrength = getPasswordStrength(signUpData.password);

  const Divider = () => (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">or</span>
      </div>
    </div>
  );

  // Helper for field error styling
  const fieldClass = (field: string, errors: Record<string, string>) =>
    errors[field] ? "border-destructive focus-visible:ring-destructive" : "";

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
              {activeTab === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {activeTab === "signin" ? "Sign in to access your dashboard" : "Join Nigeria's #1 CAD marketplace"}
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-8 shadow-card">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                {showForgotPassword ? (
                  forgotSuccess ? (
                    <div className="text-center py-4 space-y-4">
                      <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
                      <h3 className="text-lg font-semibold text-foreground">Check your email</h3>
                      <p className="text-sm text-muted-foreground">
                        We've sent a password reset link to <span className="font-medium text-foreground">{forgotEmail}</span>. Please check your inbox and spam folder.
                      </p>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => { setShowForgotPassword(false); setForgotSuccess(false); setForgotEmail(""); setForgotErrors({}); }}
                      >
                        Back to Sign In
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center mb-2">
                        <h3 className="text-lg font-semibold text-foreground">Reset your password</h3>
                        <p className="text-sm text-muted-foreground mt-1">Enter your email or username and we'll send you a reset link</p>
                      </div>
                      <form onSubmit={handleForgotPassword} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="forgot-identifier">Email or Username</Label>
                          <Input
                            id="forgot-identifier"
                            type="text"
                            placeholder="you@example.com or username"
                            value={forgotEmail}
                            onChange={(e) => {
                              setForgotEmail(e.target.value);
                              if (forgotErrors.identifier) setForgotErrors({});
                            }}
                            className={fieldClass("identifier", forgotErrors)}
                          />
                          {forgotErrors.identifier && <p className="text-sm text-destructive">{forgotErrors.identifier}</p>}
                        </div>
                        <Button type="submit" className="w-full" size="lg" disabled={forgotLoading}>
                          {forgotLoading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                          ) : (
                            "Send Reset Link"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full text-sm"
                          onClick={() => { setShowForgotPassword(false); setForgotEmail(""); setForgotErrors({}); }}
                        >
                          Back to Sign In
                        </Button>
                      </form>
                    </div>
                  )
                ) : (
                  <>
                    <GoogleButton label="Continue with Google" />
                    <Divider />
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signin-identifier">Email or Username</Label>
                        <Input
                          id="signin-identifier"
                          type="text"
                          placeholder="you@example.com or username"
                          value={signInData.identifier}
                          onChange={(e) => {
                            setSignInData({ ...signInData, identifier: e.target.value });
                            if (signInErrors.identifier) setSignInErrors((prev) => { const { identifier, ...rest } = prev; return rest; });
                          }}
                          className={fieldClass("identifier", signInErrors)}
                        />
                        {signInErrors.identifier && <p className="text-sm text-destructive">{signInErrors.identifier}</p>}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="signin-password">Password</Label>
                          <button
                            type="button"
                            onClick={() => { setShowForgotPassword(true); setSignInErrors({}); }}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            id="signin-password"
                            type={showSignInPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={signInData.password}
                            onChange={(e) => {
                              setSignInData({ ...signInData, password: e.target.value });
                              if (signInErrors.password) setSignInErrors((prev) => { const { password, ...rest } = prev; return rest; });
                            }}
                            className={cn("pr-10", fieldClass("password", signInErrors))}
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignInPassword(!showSignInPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showSignInPassword ? "Hide password" : "Show password"}
                          >
                            {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {signInErrors.password && <p className="text-sm text-destructive">{signInErrors.password}</p>}
                      </div>

                      {signInErrors.general && (
                        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                          <span className="shrink-0 mt-0.5">⚠</span>
                          <div>
                            <p>{signInErrors.general}</p>
                            {(signInErrors.general.includes("Network") || signInErrors.general.includes("timed out")) && (
                              <button
                                type="submit"
                                className="mt-1.5 text-xs font-medium underline hover:no-underline"
                              >
                                Retry
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <Button type="submit" className="w-full" size="lg" disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </Button>
                    </form>
                  </>
                )}
              </TabsContent>

              <TabsContent value="signup">
                {signUpSuccess ? (
                  <div className="text-center py-6 space-y-5">
                    <CheckCircle2 className="h-14 w-14 mx-auto text-primary" />
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Account Created!</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        Please check your email at <span className="font-medium text-foreground">{signUpData.email}</span> to verify your account.
                      </p>
                    </div>

                    <div className="bg-muted/50 rounded-xl border border-border p-5 text-left space-y-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold text-foreground">Set Up Transaction Security</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        After verifying your email and signing in, go to <span className="font-medium text-foreground">Edit Profile</span> to set your <span className="font-medium text-foreground">6-digit authentication code</span>. This code is required for:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-1">
                        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Funding milestones & escrow</li>
                        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Wallet withdrawals</li>
                        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Publishing contest winners</li>
                        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Deleting your account</li>
                      </ul>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => {
                        setSignUpSuccess(false);
                        setActiveTab("signin");
                      }}
                    >
                      Go to Sign In
                    </Button>
                  </div>
                ) : (signupsPaused || platformFrozen) ? (
                  <div className="text-center py-8 space-y-3">
                    <ShieldCheck className="h-12 w-12 mx-auto text-destructive" />
                    <h3 className="text-lg font-semibold text-foreground">
                      {platformFrozen ? "Platform Under Maintenance" : "Registrations Paused"}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {platformFrozen
                        ? "The platform is temporarily under maintenance. Please check back later."
                        : "New account registrations are temporarily paused. Please check back later."}
                    </p>
                    <Button variant="outline" onClick={() => setActiveTab("signin")}>
                      Sign In Instead
                    </Button>
                  </div>
                ) : (
                  <>
                    <GoogleButton label="Continue with Google" />
                    <Divider />
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-3">
                        <Label id="role-label">I want to...</Label>
                        <RadioGroup
                          value={signUpData.role}
                          onValueChange={(value: "client" | "freelancer") => setSignUpData({ ...signUpData, role: value, occupation: "", occupationOther: "" })}
                          className="grid grid-cols-2 gap-3"
                        >
                          <label
                            htmlFor="role-client"
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              signUpData.role === "client"
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-muted-foreground"
                            }`}
                          >
                            <RadioGroupItem value="client" id="role-client" className="sr-only" />
                            <Briefcase className={`h-6 w-6 ${signUpData.role === "client" ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`font-medium ${signUpData.role === "client" ? "text-primary" : ""}`}>Hire Talent</span>
                            <span className="text-xs text-muted-foreground text-center">Find CAD experts</span>
                          </label>
                          <label
                            htmlFor="role-freelancer"
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              signUpData.role === "freelancer"
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-muted-foreground"
                            }`}
                          >
                            <RadioGroupItem value="freelancer" id="role-freelancer" className="sr-only" />
                            <Users className={`h-6 w-6 ${signUpData.role === "freelancer" ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`font-medium ${signUpData.role === "freelancer" ? "text-primary" : ""}`}>Find Work</span>
                            <span className="text-xs text-muted-foreground text-center">Offer CAD services</span>
                          </label>
                        </RadioGroup>
                      </div>

                      {/* Occupation field */}
                      <div className="space-y-2">
                        <Label htmlFor="signup-occupation">Occupation <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        {signUpData.role === "freelancer" ? (
                          <>
                            <Select
                              value={signUpData.occupation}
                              onValueChange={(v) => {
                                setSignUpData({ ...signUpData, occupation: v, occupationOther: v !== "Others" ? "" : signUpData.occupationOther });
                                if (signUpErrors.occupation) setSignUpErrors((prev) => { const { occupation, ...rest } = prev; return rest; });
                                if (signUpErrors.occupationOther) setSignUpErrors((prev) => { const { occupationOther, ...rest } = prev; return rest; });
                              }}
                            >
                              <SelectTrigger className={fieldClass("occupation", signUpErrors)}>
                                <SelectValue placeholder="Select your occupation" />
                              </SelectTrigger>
                              <SelectContent>
                                {["Engineer", "Technician", "Maker", "Student", "Others"].map((opt) => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {signUpData.occupation === "Others" && (
                              <div className="space-y-1">
                                <Input
                                  placeholder="e.g. Research Scientist"
                                  value={signUpData.occupationOther}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSignUpData({ ...signUpData, occupationOther: val });
                                    if (signUpErrors.occupationOther) setSignUpErrors((prev) => { const { occupationOther, ...rest } = prev; return rest; });
                                  }}
                                  maxLength={50}
                                  className={fieldClass("occupationOther", signUpErrors)}
                                />
                                <p className="text-xs text-muted-foreground">Keep it brief — max 5 words</p>
                                {signUpErrors.occupationOther && <p className="text-sm text-destructive">{signUpErrors.occupationOther}</p>}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="space-y-1">
                            <Input
                              placeholder="e.g. Project Manager"
                              value={signUpData.occupation}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSignUpData({ ...signUpData, occupation: val });
                                if (signUpErrors.occupation) setSignUpErrors((prev) => { const { occupation, ...rest } = prev; return rest; });
                              }}
                              maxLength={50}
                              className={fieldClass("occupation", signUpErrors)}
                            />
                            <p className="text-xs text-muted-foreground">Keep it brief — max 5 words</p>
                            {signUpErrors.occupation && <p className="text-sm text-destructive">{signUpErrors.occupation}</p>}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Full Name</Label>
                        <Input
                          id="signup-name"
                          placeholder="Adewale Okonkwo"
                          value={signUpData.fullName}
                          onChange={(e) => {
                            setSignUpData({ ...signUpData, fullName: e.target.value });
                            if (signUpErrors.fullName) setSignUpErrors((prev) => { const { fullName, ...rest } = prev; return rest; });
                          }}
                          className={fieldClass("fullName", signUpErrors)}
                        />
                        <p className="text-xs text-muted-foreground">Enter your full legal name (first and last name)</p>
                        {signUpErrors.fullName && <p className="text-sm text-destructive">{signUpErrors.fullName}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-username">Username</Label>
                        <Input
                          id="signup-username"
                          placeholder="adewale_cad"
                          value={signUpData.username}
                          onChange={(e) => {
                            setSignUpData({ ...signUpData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") });
                            if (signUpErrors.username) setSignUpErrors((prev) => { const { username, ...rest } = prev; return rest; });
                          }}
                          maxLength={30}
                          className={fieldClass("username", signUpErrors)}
                        />
                        <p className="text-xs text-muted-foreground">Letters, numbers, and underscores only. Cannot be changed later.</p>
                        {signUpErrors.username && <p className="text-sm text-destructive">{signUpErrors.username}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          value={signUpData.email}
                          onChange={(e) => {
                            setSignUpData({ ...signUpData, email: e.target.value });
                            if (signUpErrors.email) setSignUpErrors((prev) => { const { email, ...rest } = prev; return rest; });
                          }}
                          className={fieldClass("email", signUpErrors)}
                        />
                        {signUpErrors.email && <p className="text-sm text-destructive">{signUpErrors.email}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                          <Input
                            id="signup-password"
                            type={showSignUpPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={signUpData.password}
                            onChange={(e) => {
                              setSignUpData({ ...signUpData, password: e.target.value });
                              if (signUpErrors.password) setSignUpErrors((prev) => { const { password, ...rest } = prev; return rest; });
                            }}
                            className={cn("pr-10", fieldClass("password", signUpErrors))}
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                          >
                            {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {signUpData.password && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full transition-all duration-300", passwordStrength.color, passwordStrength.width)} />
                              </div>
                              <span className={cn("text-xs font-medium", 
                                passwordStrength.label === "Weak" ? "text-destructive" : 
                                passwordStrength.label === "Fair" ? "text-amber-500" : 
                                passwordStrength.label === "Good" ? "text-accent" : "text-primary"
                              )}>{passwordStrength.label}</span>
                            </div>
                            <ul className="text-xs text-muted-foreground space-y-0.5">
                              <li className={signUpData.password.length >= 8 ? "text-primary" : ""}>
                                {signUpData.password.length >= 8 ? "✓" : "○"} At least 8 characters
                              </li>
                              <li className={/[A-Z]/.test(signUpData.password) ? "text-primary" : ""}>
                                {/[A-Z]/.test(signUpData.password) ? "✓" : "○"} One uppercase letter
                              </li>
                              <li className={/[a-z]/.test(signUpData.password) ? "text-primary" : ""}>
                                {/[a-z]/.test(signUpData.password) ? "✓" : "○"} One lowercase letter
                              </li>
                              <li className={/[0-9]/.test(signUpData.password) ? "text-primary" : ""}>
                                {/[0-9]/.test(signUpData.password) ? "✓" : "○"} One number
                              </li>
                              <li className={/[^A-Za-z0-9]/.test(signUpData.password) ? "text-primary" : ""}>
                                {/[^A-Za-z0-9]/.test(signUpData.password) ? "✓" : "○"} One special character
                              </li>
                            </ul>
                          </div>
                        )}
                        {signUpErrors.password && <p className="text-sm text-destructive">{signUpErrors.password}</p>}
                      </div>

                      <div className="flex justify-center">
                        <div ref={recaptchaContainerRef} />
                      </div>

                      {/* Terms & Conditions checkbox */}
                      <div className="space-y-1">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (!termsAccepted) {
                                setTermsModalOpen(true);
                              }
                            }}
                            className={cn(
                              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                              termsAccepted
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/40 bg-muted/50"
                            )}
                            aria-label="Agree to terms"
                          >
                            {termsAccepted && <Check className="h-3 w-3" />}
                          </button>
                          <p className="text-sm text-muted-foreground leading-tight">
                            I agree to the{" "}
                            <button
                              type="button"
                              onClick={() => setTermsModalOpen(true)}
                              className="text-primary hover:underline font-medium"
                            >
                              Terms and Conditions
                            </button>
                          </p>
                        </div>
                        {signUpErrors.terms && (
                          <p className="text-sm text-destructive ml-7">{signUpErrors.terms}</p>
                        )}
                      </div>

                      <Button type="submit" className="w-full" size="lg" disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          "Create Account"
                        )}
                      </Button>

                      <TermsModal
                        open={termsModalOpen}
                        onOpenChange={setTermsModalOpen}
                        onAgree={() => {
                          setTermsAccepted(true);
                          if (signUpErrors.terms) {
                            setSignUpErrors((prev) => {
                              const { terms, ...rest } = prev;
                              return rest;
                            });
                          }
                        }}
                      />
                    </form>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Verified Experts
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Secure Payments
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Nigerian Focus
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              WhatsApp Support
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
