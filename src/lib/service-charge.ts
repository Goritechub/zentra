/**
 * Calculate the platform service charge based on tiered rates.
 * ≤ 1,000,000: 18%
 * 1,000,001 – 5,000,000: 15%
 * 5,000,001 – 10,000,000: 10%
 * > 10,000,000: 7%
 */
export function getServiceChargeRate(amount: number): number {
  if (amount <= 1_000_000) return 0.18;
  if (amount <= 5_000_000) return 0.15;
  if (amount <= 10_000_000) return 0.10;
  return 0.07;
}

export function getServiceChargeLabel(amount: number): string {
  if (amount <= 1_000_000) return "18%";
  if (amount <= 5_000_000) return "15%";
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
