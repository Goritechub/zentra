/**
 * Calculate the platform service charge based on tiered rates.
 * ₦5k–₦300k → 20%
 * ₦300k–₦2M → 15%
 * ₦2M–₦10M → 10%
 * ₦10M+ → 7%
 */
export function getServiceChargeRate(amount: number): number {
  if (amount <= 300_000) return 0.20;
  if (amount <= 2_000_000) return 0.15;
  if (amount <= 10_000_000) return 0.10;
  return 0.07;
}

export function getServiceChargeLabel(amount: number): string {
  if (amount <= 300_000) return "20%";
  if (amount <= 2_000_000) return "15%";
  if (amount <= 10_000_000) return "10%";
  return "7%";
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
