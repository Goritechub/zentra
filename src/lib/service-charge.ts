import { supabase } from "@/integrations/supabase/client";

export interface CommissionTier {
  max_amount: number | null;
  rate: number; // percentage e.g. 20 for 20%
  label: string;
}

export interface CommissionPromo {
  active: boolean;
  label: string;
  discount_percent: number; // e.g. 50 for 50% off
  starts_at: string;
  ends_at: string;
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
let cachedPromo: CommissionPromo | null = null;
let promoCacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds for faster admin changes propagation

// Preload tiers + promo on module init so sync helpers use DB values
let _preloadPromise: Promise<void> | null = null;
export function preloadCommissionTiers() {
  if (!_preloadPromise) {
    _preloadPromise = Promise.all([getCommissionTiers(), getCommissionPromo()]).then(() => {
      _preloadPromise = null;
    });
  }
  return _preloadPromise;
}

export async function getCommissionTiers(): Promise<CommissionTier[]> {
  if (cachedTiers && Date.now() - cacheTime < CACHE_TTL) return cachedTiers;

  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "commission_tiers")
      .maybeSingle();

    if (data?.value && Array.isArray(data.value)) {
      cachedTiers = data.value as unknown as CommissionTier[];
      cacheTime = Date.now();
      return cachedTiers;
    }
  } catch (e) {
    console.error("Failed to load commission tiers:", e);
  }

  return DEFAULT_TIERS;
}

export async function getCommissionPromo(): Promise<CommissionPromo | null> {
  if (promoCacheTime !== 0 && Date.now() - promoCacheTime < CACHE_TTL) return cachedPromo;

  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "commission_promo")
      .maybeSingle();

    cachedPromo = (data?.value as unknown as CommissionPromo) || null;
    promoCacheTime = Date.now();
  } catch (e) {
    console.error("Failed to load commission promo:", e);
  }

  return cachedPromo;
}

/** Clear cache so next call re-fetches from DB */
export function invalidateCommissionCache() {
  cachedTiers = null;
  cacheTime = 0;
  cachedPromo = null;
  promoCacheTime = 0;
}

/**
 * Synchronous helpers using DEFAULT_TIERS/cached tiers and the cached promo.
 * For accurate DB-backed rates, use the async versions above.
 */
function getTiers(): CommissionTier[] {
  return cachedTiers || DEFAULT_TIERS;
}

function getActivePromo(): CommissionPromo | null {
  const promo = cachedPromo;
  if (!promo?.active) return null;
  const now = Date.now();
  if (now < new Date(promo.starts_at).getTime() || now > new Date(promo.ends_at).getTime()) return null;
  return promo;
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

export function calculateServiceCharge(amount: number, feeMultiplier = 1.0) {
  const baseRate = getServiceChargeRate(amount);
  const promo = getActivePromo();
  const promoMultiplier = promo ? 1 - promo.discount_percent / 100 : 1;
  const rate = baseRate * promoMultiplier * feeMultiplier;
  const charge = Math.round(amount * rate);
  const rateLabel = promoMultiplier === 1 && feeMultiplier === 1.0
    ? getServiceChargeLabel(amount)
    : `${Math.round(rate * 1000) / 10}%`;
  return {
    rate,
    rateLabel,
    charge,
    takeHome: amount - charge,
    // Pre-promo rate/label, so callers can render a struck-through "was X%" next to rateLabel.
    originalRateLabel: promo ? getServiceChargeLabel(amount) : null,
    promoLabel: promo?.label ?? null,
  };
}
