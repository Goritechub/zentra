import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { ZentraGigLogo } from "@/components/ZentraGigLogo";
import { verifyEmailToken } from "@/api/auth.api";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("This link is missing its verification token.");
      return;
    }

    verifyEmailToken(token)
      .then(() => {
        setStatus("success");
        setTimeout(() => navigate("/auth"), 3000);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Could not verify your email. Please try again.");
      });
  }, [token, navigate]);

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
              {status === "success" ? "Email Confirmed!" : status === "error" ? "Verification Failed" : "Confirming Your Email"}
            </h1>
          </div>

          <div className="bg-card rounded-2xl border border-border p-8 shadow-card text-center space-y-4">
            {status === "verifying" && (
              <>
                <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                <p className="text-muted-foreground text-sm">Confirming your email address...</p>
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
                <p className="text-muted-foreground text-sm">
                  Your email has been confirmed. Redirecting you to sign in...
                </p>
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
              </>
            )}
            {status === "error" && (
              <>
                <ShieldAlert className="h-12 w-12 mx-auto text-destructive" />
                <p className="text-muted-foreground text-sm">{errorMessage}</p>
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  Go to Sign In
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
