import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Briefcase, Users, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";

const signUpSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  role: z.enum(["client", "freelancer"]),
});

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, signUp, signIn, loading: authLoading } = useAuth();
  
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "signin";
  const defaultRole = searchParams.get("role") === "freelancer" ? "freelancer" : "client";

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [loading, setLoading] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  
  const [signUpData, setSignUpData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: defaultRole as "client" | "freelancer",
  });
  const [signUpErrors, setSignUpErrors] = useState<Record<string, string>>({});

  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });
  const [signInErrors, setSignInErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && !authLoading && profile) {
      const redirect = searchParams.get("redirect");
      if (redirect) {
        navigate(redirect);
      } else if (profile.role === "freelancer") {
        navigate("/jobs");
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, authLoading, profile, navigate, searchParams]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpErrors({});

    const result = signUpSchema.safeParse(signUpData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0].toString()] = err.message;
      });
      setSignUpErrors(errors);
      return;
    }

    setLoading(true);
    const { error } = await signUp(signUpData.email, signUpData.password, signUpData.role, signUpData.fullName);

    if (error) {
      toast.error(error.message.includes("already registered") 
        ? "This email is already registered. Please sign in instead." 
        : error.message);
      setLoading(false);
      return;
    }

    toast.success("Account created! Please check your email to verify your account.");
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInErrors({});

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
    const { error } = await signIn(signInData.email, signInData.password);

    if (error) {
      toast.error(error.message.includes("Invalid login credentials")
        ? "Invalid email or password. Please try again."
        : error.message);
      setLoading(false);
      return;
    }

    toast.success("Welcome back!");
    // Role-based redirect is handled by the useEffect watching profile
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-xl font-bold text-primary-foreground">C</span>
              </div>
              <span className="text-2xl font-bold text-foreground">
                CAD<span className="text-primary">Gigs</span>
              </span>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">
              {activeTab === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {activeTab === "signin"
                ? "Sign in to access your dashboard"
                : "Join Nigeria's #1 CAD marketplace"}
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-8 shadow-card">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    />
                    {signInErrors.email && <p className="text-sm text-destructive">{signInErrors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showSignInPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={signInData.password}
                        onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                        className="pr-10"
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

                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? (<><Loader2 className="h-4 w-4 animate-spin" />Signing in...</>) : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-3">
                    <Label>I want to...</Label>
                    <RadioGroup
                      value={signUpData.role}
                      onValueChange={(value: "client" | "freelancer") =>
                        setSignUpData({ ...signUpData, role: value })
                      }
                      className="grid grid-cols-2 gap-3"
                    >
                      <label
                        htmlFor="role-client"
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          signUpData.role === "client" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
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
                          signUpData.role === "freelancer" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <RadioGroupItem value="freelancer" id="role-freelancer" className="sr-only" />
                        <Users className={`h-6 w-6 ${signUpData.role === "freelancer" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`font-medium ${signUpData.role === "freelancer" ? "text-primary" : ""}`}>Find Work</span>
                        <span className="text-xs text-muted-foreground text-center">Offer CAD services</span>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      placeholder="Adewale Okonkwo"
                      value={signUpData.fullName}
                      onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                    />
                    {signUpErrors.fullName && <p className="text-sm text-destructive">{signUpErrors.fullName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
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
                        onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                        className="pr-10"
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
                    {signUpErrors.password && <p className="text-sm text-destructive">{signUpErrors.password}</p>}
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? (<><Loader2 className="h-4 w-4 animate-spin" />Creating account...</>) : "Create Account"}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground mt-4">
                    By signing up, you agree to our{" "}
                    <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />Verified Experts
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />Secure Payments
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />Nigerian Focus
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />WhatsApp Support
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
