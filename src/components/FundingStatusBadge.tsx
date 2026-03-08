import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, ShieldCheck, AlertTriangle } from "lucide-react";

export type FundingStatus = "escrow_funded" | "payment_ready" | "funding_needed" | "negotiable";


interface FundingStatusBadgeProps {
  clientId: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  contractId?: string | null;
  /** Skip internal fetch — use pre-computed status */
  status?: FundingStatus;
  className?: string;
}

export function computeFundingStatus(
  walletBalance: number | null,
  budgetMin: number | null | undefined,
  budgetMax: number | null | undefined,
  escrowHeld: number
): FundingStatus {
  if (!budgetMin && !budgetMax) return "negotiable";
  if (escrowHeld > 0) return "escrow_funded";
  const target = budgetMax || budgetMin || 0;
  if ((walletBalance ?? 0) >= target) return "payment_ready";
  return "funding_needed";
}

const STATUS_MAP: Record<FundingStatus, { variant: "default" | "destructive" | "outline" | "secondary"; icon: typeof DollarSign; label: string; emoji: string }> = {
  escrow_funded: { variant: "default", icon: ShieldCheck, label: "Escrow Funded", emoji: "🔒" },
  payment_ready: { variant: "default", icon: DollarSign, label: "Payment Ready", emoji: "💰" },
  funding_needed: { variant: "destructive", icon: AlertTriangle, label: "Funding Needed", emoji: "⚠" },
  negotiable: { variant: "outline", icon: DollarSign, label: "Budget Negotiable", emoji: "💬" },
};

export function FundingStatusBadge({ clientId, budgetMin, budgetMax, contractId, status: precomputed, className }: FundingStatusBadgeProps) {
  const [status, setStatus] = useState<FundingStatus | null>(precomputed ?? null);

  useEffect(() => {
    if (precomputed) { setStatus(precomputed); return; }
    let cancelled = false;

    const compute = async () => {
      const [walletRes, escrowRes] = await Promise.all([
        supabase.from("wallets").select("balance").eq("user_id", clientId).maybeSingle(),
        contractId
          ? supabase.from("escrow_ledger").select("held_amount, status").eq("contract_id", contractId).eq("status", "held")
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancelled) return;
      const walletBalance = walletRes.data?.balance ?? 0;
      const escrowHeld = (escrowRes.data || []).reduce((s: number, e: any) => s + (e.held_amount || 0), 0);
      setStatus(computeFundingStatus(walletBalance, budgetMin, budgetMax, escrowHeld));
    };

    compute();

    // Subscribe to wallet changes for real-time updates
    const channel = supabase
      .channel(`funding-status-${clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${clientId}` }, () => compute())
      .on("postgres_changes", { event: "*", schema: "public", table: "escrow_ledger", ...(contractId ? { filter: `contract_id=eq.${contractId}` } : {}) }, () => compute())
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [clientId, budgetMin, budgetMax, contractId, precomputed]);

  if (!status) return null;

  const cfg = STATUS_MAP[status];
  const Icon = cfg.icon;

  return (
    <Badge variant={cfg.variant} className={`gap-1 text-xs ${className || ""}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

/**
 * Hook variant for pages that need the raw status value
 */
export function useFundingStatus(
  clientId: string | undefined,
  budgetMin: number | null | undefined,
  budgetMax: number | null | undefined,
  contractId?: string | null,
  walletBalance?: number | null,
  escrowHeld?: number
): FundingStatus | null {
  if (!clientId) return null;
  if (walletBalance !== undefined) {
    return computeFundingStatus(walletBalance, budgetMin, budgetMax, escrowHeld ?? 0);
  }
  return null;
}
