import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { getRates } from "@/api/currency.api";
import { formatCurrency, type FxRates, type SupportedCurrency } from "@/lib/currency";
import { updateMyProfileData } from "@/api/profile.api";
import { useAuth } from "./useAuth";

interface CurrencyContextType {
  currency: SupportedCurrency;
  rates: FxRates;
  format: (amountNgn: number) => string;
  setCurrency: (currency: SupportedCurrency) => Promise<void>;
}

const FALLBACK_RATES: FxRates = { USD_NGN: null, NGN_USD: null, NGN_GBP: null, NGN_EUR: null, NGN_GHS: null, NGN_KES: null };

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [rates, setRates] = useState<FxRates>(FALLBACK_RATES);
  const [currency, setCurrencyState] = useState<SupportedCurrency>("NGN");

  useEffect(() => {
    if (profile?.preferred_currency) {
      setCurrencyState(profile.preferred_currency);
    }
  }, [profile?.preferred_currency]);

  useEffect(() => {
    getRates()
      .then(setRates)
      .catch(() => {});
  }, []);

  const format = useCallback(
    (amountNgn: number) => formatCurrency(amountNgn, currency, rates),
    [currency, rates],
  );

  const setCurrency = useCallback(async (next: SupportedCurrency) => {
    setCurrencyState(next);
    try {
      await updateMyProfileData({ preferredCurrency: next });
    } catch {
      // Non-blocking — local state already updated
    }
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency, rates, format, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextType {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
