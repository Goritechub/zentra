import { useEffect, useState } from "react";
import { resendVerificationEmail } from "@/api/auth.api";

export type ResendFeedback = { type: "success" | "error"; message: string } | null;

export function useResendVerification() {
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [feedback, setFeedback] = useState<ResendFeedback>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async (email: string) => {
    if (loading || cooldown > 0 || !email) return;

    setLoading(true);
    setFeedback(null);
    try {
      await resendVerificationEmail(email);
      setFeedback({ type: "success", message: "Verification email resent." });
      setCooldown(60);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Could not resend the email. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setCooldown(0);
    setFeedback(null);
  };

  return { loading, cooldown, feedback, resend, reset };
}
