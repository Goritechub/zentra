import { api } from "./axios";

export async function createFundingIntent(amountMinorUnits: number, currency: string) {
  const res = await api.post("/stripe/fund/intent", { amount: amountMinorUnits, currency });
  return res.data.data as {
    clientSecret: string;
    intentId: string;
    fxRate: number | null;
    ngnEquivalent: number | null;
  };
}

export async function getConnectStatus() {
  const res = await api.get("/stripe/connect/status");
  return res.data.data as {
    connected: boolean;
    onboarding_complete: boolean;
    payouts_enabled: boolean;
    stripe_account_id: string | null;
  };
}

export async function createOnboardingLink(returnUrl: string, refreshUrl: string) {
  const res = await api.post("/stripe/connect/onboard", {
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });
  return res.data.data as { url: string };
}

export async function initiateStripePayout(amountNgn: number) {
  const res = await api.post("/stripe/payout", { amount_ngn: amountNgn });
  return res.data.data as {
    transfer_id: string;
    amount_ngn: number;
    amount_usd: number;
  };
}
