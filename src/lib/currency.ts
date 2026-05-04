export type SupportedCurrency = "NGN" | "USD";

export interface FxRates {
  USD_NGN: number | null;
  NGN_USD: number | null;
  NGN_GBP: number | null;
  NGN_EUR: number | null;
  NGN_GHS: number | null;
  NGN_KES: number | null;
}

export function formatCurrency(
  amountNgn: number,
  currency: SupportedCurrency,
  rates: FxRates,
): string {
  if (currency === "USD") {
    const rate = rates.NGN_USD;
    if (!rate) return formatNgn(amountNgn);
    const usd = amountNgn * rate;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(usd);
  }
  return formatNgn(amountNgn);
}

function formatNgn(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}
