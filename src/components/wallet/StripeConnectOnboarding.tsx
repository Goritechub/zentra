import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Globe, CheckCircle2, AlertCircle } from "lucide-react";
import { getConnectStatus, createOnboardingLink } from "@/api/stripe.api";
import { toast } from "sonner";

interface StripeConnectOnboardingProps {
  /** Only show the banner when this is true (e.g. user has received international payments) */
  show?: boolean;
}

type ConnectState = "loading" | "not_connected" | "incomplete" | "ready" | "error";

export function StripeConnectOnboarding({ show = true }: StripeConnectOnboardingProps) {
  const [connectState, setConnectState] = useState<ConnectState>("loading");
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    if (!show) return;
    getConnectStatus()
      .then((status) => {
        if (!status.connected) setConnectState("not_connected");
        else if (!status.onboarding_complete || !status.payouts_enabled) setConnectState("incomplete");
        else setConnectState("ready");
      })
      .catch(() => setConnectState("error"));
  }, [show]);

  const handleConnect = async () => {
    setOnboarding(true);
    try {
      const returnUrl = `${window.location.origin}/wallet?stripe_onboard=complete`;
      const refreshUrl = `${window.location.origin}/wallet?stripe_onboard=refresh`;
      const result = await createOnboardingLink(returnUrl, refreshUrl);
      window.location.href = result.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start Stripe onboarding");
      setOnboarding(false);
    }
  };

  if (!show || connectState === "loading" || connectState === "ready" || connectState === "error") {
    return null;
  }

  const isIncomplete = connectState === "incomplete";

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
      <div className="shrink-0 mt-0.5">
        {isIncomplete ? (
          <AlertCircle className="h-5 w-5 text-amber-500" />
        ) : (
          <Globe className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {isIncomplete
            ? "Complete your international payout setup"
            : "Connect an international bank account"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {isIncomplete
            ? "Your Stripe account isn't fully verified. Complete setup to receive international payouts."
            : "Connect your bank account via Stripe to receive payouts in your local currency."}
        </p>
      </div>
      <Button size="sm" onClick={handleConnect} disabled={onboarding} className="shrink-0">
        {onboarding ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isIncomplete ? (
          "Resume Setup"
        ) : (
          "Connect with Stripe"
        )}
      </Button>
    </div>
  );
}

/** Small inline indicator for use in profile/settings pages */
export function StripeConnectBadge() {
  const [status, setStatus] = useState<{ ready: boolean; loading: boolean }>({ ready: false, loading: true });

  useEffect(() => {
    getConnectStatus()
      .then((s) => setStatus({ ready: s.payouts_enabled, loading: false }))
      .catch(() => setStatus({ ready: false, loading: false }));
  }, []);

  if (status.loading) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {status.ready ? (
        <>
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span>International payouts enabled</span>
        </>
      ) : (
        <>
          <Globe className="h-3 w-3" />
          <span>International payouts not set up</span>
        </>
      )}
    </div>
  );
}
