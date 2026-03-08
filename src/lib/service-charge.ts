import { supabase } from "@/integrations/supabase/client";

export interface CommissionTier {
  max_amount: number | null;
  rate: number; // percentage e.g. 20 for 20%
  label: string;
}

// Default tiers (fallback if DB unavailable)
const DEFAULT_TIERS: CommissionTier[] = [
  { max_amount: 300_000, rate: 20, label: "Up to ₦300,000" },
  { max_amount: 2_000_000, rate: 15, label: "₦300,001 – ₦2,000,000" },
  { max_amount: 10_000_000, rate: 10, label: "₦2,000,001 – ₦10,000,000" },
  { max_amount: null, rate: 7, label: "Above ₦10,000,000" },
];

// Cache to avoid repeated DB reads in the same session
let cachedTiers: CommissionTier[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function getCommissionTiers(): Promise<CommissionTier[]> {
  if (cachedTiers && Date.now() - cacheTime < CACHE_TTL) return cachedTiers;

  try {
    const { data } = await (supabase
      .from("platform_settings" as any)
      .select("value")
      .eq("key", "commission_tiers")
      .maybeSingle() as any);

    if (data?.value && Array.isArray(data.value)) {
      cachedTiers = data.value as CommissionTier[];
      cacheTime = Date.now();
      return cachedTiers;
    }
  } catch (e) {
    console.error("Failed to load commission tiers:", e);
  }

  return DEFAULT_TIERS;
}

/** Clear cache so next call re-fetches from DB */
export function invalidateCommissionCache() {
  cachedTiers = null;
  cacheTime = 0;
}

/**
 * Synchronous helpers using DEFAULT_TIERS or cached tiers.
 * For accurate DB-backed rates, use the async version.
 */
function getTiers(): CommissionTier[] {
  return cachedTiers || DEFAULT_TIERS;
}

export function getServiceChargeRate(amount: number): number {
  const tiers = getTiers();
  for (const tier of tiers) {
    if (tier.max_amount === null || amount <= tier.max_amount) {
      return tier.rate / 100;
    }
  }
  return tiers[tiers.length - 1].rate / 100;
}

export function getServiceChargeLabel(amount: number): string {
  const tiers = getTiers();
  for (const tier of tiers) {
    if (tier.max_amount === null || amount <= tier.max_amount) {
      return `${tier.rate}%`;
    }
  }
  return `${tiers[tiers.length - 1].rate}%`;
}

export function calculateServiceCharge(amount: number) {
  const rate = getServiceChargeRate(amount);
  const charge = Math.round(amount * rate);
  return {
    rate,
    rateLabel: getServiceChargeLabel(amount),
    charge,
    takeHome: amount - charge,
  };
}
