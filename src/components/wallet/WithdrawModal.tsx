import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/api/axios";
import { formatNaira } from "@/lib/nigerian-data";
import { toast } from "sonner";
import { Loader2, Building2, CheckCircle2, AlertTriangle, Globe, Link } from "lucide-react";
import { getConnectStatus, createOnboardingLink, initiateStripePayout } from "@/api/stripe.api";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  walletBalance: number;
  userId: string;
}

const MIN_WITHDRAWAL = 5000;

type Step =
  | "method_select"
  | "bank_select"
  | "add_bank"
  | "amount"
  | "confirm"
  | "stripe_check"
  | "stripe_onboard"
  | "stripe_amount"
  | "stripe_confirm"
  | "processing"
  | "success"
  | "failed";

type PayoutMethod = "paystack" | "stripe";

export function WithdrawModal({ open, onOpenChange, onSuccess, walletBalance, userId }: WithdrawModalProps) {
  const [step, setStep] = useState<Step>("method_select");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("paystack");
  const [loading, setLoading] = useState(false);
  const [bankDetails, setBankDetails] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [banks, setBanks] = useState<any[]>([]);

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [selectedBankName, setSelectedBankName] = useState("");

  // Stripe Connect state
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    onboarding_complete: boolean;
    payouts_enabled: boolean;
  } | null>(null);
  const [stripeCheckLoading, setStripeCheckLoading] = useState(false);
  const [stripeUsdEquivalent, setStripeUsdEquivalent] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      fetchBankDetails();
    }
  }, [open]);

  const fetchBankDetails = async () => {
    const { data } = await supabase
      .from("bank_details" as any)
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false });
    setBankDetails((data as any[]) || []);
    if (data && data.length > 0) {
      setSelectedBank(data[0]);
    }
  };

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const res = await api.post("/wallet/paystack-transfer", { action: "list_banks" });
      if (res.data?.banks) setBanks(res.data.banks);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const resolveAccount = async () => {
    if (accountNumber.length !== 10 || !bankCode) return;
    setResolving(true);
    try {
      const res = await api.post("/wallet/paystack-transfer", { action: "resolve_account", account_number: accountNumber, bank_code: bankCode });
      if (res.data?.success && res.data.data?.account_name) {
        setResolvedName(res.data.data.account_name);
      } else {
        toast.error("Could not resolve account. Check details.");
        setResolvedName("");
      }
    } catch {
      toast.error("Could not resolve account. Check details.");
      setResolvedName("");
    }
    setResolving(false);
  };

  const saveBankDetails = async () => {
    if (!resolvedName || !bankCode || !accountNumber) {
      toast.error("Please resolve your account first");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/wallet/paystack-transfer", {
        action: "save_bank", account_number: accountNumber, bank_code: bankCode, bank_name: selectedBankName, account_name: resolvedName,
      });
      if (res.data?.success) {
        toast.success("Bank account saved");
        await fetchBankDetails();
        setSelectedBank(res.data.bank_detail);
        setStep("amount");
        setBankCode(""); setAccountNumber(""); setResolvedName("");
      } else {
        toast.error(res.data?.error || "Failed to save bank details");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save bank details");
    }
    setLoading(false);
  };

  const initiateWithdrawal = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < MIN_WITHDRAWAL) {
      toast.error(`Minimum withdrawal amount is ${formatNaira(MIN_WITHDRAWAL)}.`);
      return;
    }
    if (numAmount > walletBalance) {
      toast.error("Insufficient available balance");
      return;
    }
    setStep("confirm");
  };

  const confirmWithdrawal = async () => {
    setStep("processing");
    setLoading(true);
    try {
      const res = await api.post("/wallet/paystack-transfer", {
        action: "withdraw", amount: parseFloat(amount), bank_detail_id: selectedBank.id,
      });
      setLoading(false);
      if (res.data?.success) {
        setStep("success");
        toast.success("Withdrawal initiated!");
        onSuccess();
      } else {
        setStep("failed");
        toast.error(res.data?.error || "Withdrawal failed");
      }
    } catch (err: any) {
      setLoading(false);
      setStep("failed");
      toast.error(err?.message || "Withdrawal failed");
    }
  };

  // ── Stripe Connect payout ──

  const checkStripeStatus = async () => {
    setStripeCheckLoading(true);
    setStep("stripe_check");
    try {
      const status = await getConnectStatus();
      setStripeStatus(status);

      if (!status.connected || !status.onboarding_complete) {
        setStep("stripe_onboard");
      } else if (!status.payouts_enabled) {
        setStep("stripe_onboard");
      } else {
        setStep("stripe_amount");
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not check Stripe status");
      setStep("method_select");
    } finally {
      setStripeCheckLoading(false);
    }
  };

  const handleStripeOnboard = async () => {
    setLoading(true);
    try {
      const returnUrl = `${window.location.origin}/wallet?stripe_onboard=complete`;
      const refreshUrl = `${window.location.origin}/wallet?stripe_onboard=refresh`;
      const result = await createOnboardingLink(returnUrl, refreshUrl);
      window.location.href = result.url;
    } catch (err: any) {
      toast.error(err?.message || "Could not start Stripe onboarding");
      setLoading(false);
    }
  };

  const initiateStripePayout_ = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < MIN_WITHDRAWAL) {
      toast.error(`Minimum payout amount is ${formatNaira(MIN_WITHDRAWAL)}.`);
      return;
    }
    if (numAmount > walletBalance) {
      toast.error("Insufficient available balance");
      return;
    }
    // Rough USD estimate for display (1 NGN ≈ 0.00065 USD — actual rate applied server-side)
    setStripeUsdEquivalent(parseFloat((numAmount * 0.00065).toFixed(2)));
    setStep("stripe_confirm");
  };

  const confirmStripePayout = async () => {
    setStep("processing");
    setLoading(true);
    try {
      await initiateStripePayout(parseFloat(amount));
      setLoading(false);
      setStep("success");
      toast.success("Payout initiated! Funds will arrive in your Stripe account shortly.");
      onSuccess();
    } catch (err: any) {
      setLoading(false);
      setStep("failed");
      toast.error(err?.message || "Payout failed");
    }
  };

  const resetState = () => {
    setStep("method_select");
    setPayoutMethod("paystack");
    setAmount("");
    setSelectedBank(null);
    setResolvedName(""); setBankCode(""); setAccountNumber("");
    setLoading(false);
    setStripeStatus(null);
    setStripeUsdEquivalent(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const belowMinimum = walletBalance < MIN_WITHDRAWAL;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw Funds</DialogTitle>
          <DialogDescription>Transfer funds from your wallet to your bank account.</DialogDescription>
        </DialogHeader>

        {belowMinimum && step === "method_select" && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Minimum withdrawal amount is {formatNaira(MIN_WITHDRAWAL)}.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your available balance is {formatNaira(walletBalance)}. You need at least {formatNaira(MIN_WITHDRAWAL)} to withdraw.
              </p>
            </div>
          </div>
        )}

        {/* ── Payout method selection ── */}
        {step === "method_select" && !belowMinimum && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Available: <strong>{formatNaira(walletBalance)}</strong>
            </p>
            <div className="space-y-2">
              <Label>Payout method</Label>
              <button
                onClick={() => { setPayoutMethod("paystack"); setStep("bank_select"); }}
                className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground text-sm">Nigerian Bank Account</p>
                    <p className="text-xs text-muted-foreground">Paystack transfer · NGN · 1–3 business days</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => { setPayoutMethod("stripe"); checkStripeStatus(); }}
                className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground text-sm">International Transfer</p>
                    <p className="text-xs text-muted-foreground">Stripe Connect · USD/GBP/EUR · 2–5 business days</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Paystack: bank account selection ── */}
        {step === "bank_select" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Available for withdrawal: <strong>{formatNaira(walletBalance)}</strong></p>
            {bankDetails.length > 0 ? (
              <div className="space-y-2">
                <Label>Select Bank Account</Label>
                {bankDetails.map((bd: any) => (
                  <button
                    key={bd.id}
                    onClick={() => { setSelectedBank(bd); setStep("amount"); }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedBank?.id === bd.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground text-sm">{bd.bank_name}</p>
                        <p className="text-xs text-muted-foreground">{bd.account_number} - {bd.account_name}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No bank accounts saved. Add one to withdraw.</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("method_select")} className="flex-1">Back</Button>
              <Button variant="outline" onClick={() => { fetchBanks(); setStep("add_bank"); }} className="flex-1">
                + Add New Bank Account
              </Button>
            </div>
          </div>
        )}

        {/* ── Paystack: add bank ── */}
        {step === "add_bank" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Bank</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={bankCode}
                onChange={(e) => {
                  setBankCode(e.target.value);
                  const b = banks.find((b: any) => b.code === e.target.value);
                  setSelectedBankName(b?.name || "");
                  setResolvedName("");
                }}
              >
                <option value="">Select bank...</option>
                {banks.map((b: any) => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input
                maxLength={10}
                placeholder="0000000000"
                value={accountNumber}
                onChange={(e) => { setAccountNumber(e.target.value); setResolvedName(""); }}
              />
            </div>
            {accountNumber.length === 10 && bankCode && !resolvedName && (
              <Button variant="outline" size="sm" onClick={resolveAccount} disabled={resolving}>
                {resolving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Verify Account
              </Button>
            )}
            {resolvedName && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm font-medium text-foreground">{resolvedName}</p>
                <p className="text-xs text-muted-foreground">{selectedBankName} - {accountNumber}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("bank_select")} className="flex-1">Back</Button>
              <Button onClick={saveBankDetails} disabled={loading || !resolvedName} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save & Continue
              </Button>
            </div>
          </div>
        )}

        {/* ── Paystack: amount entry ── */}
        {step === "amount" && payoutMethod === "paystack" && (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">Withdraw to</p>
              <p className="font-medium text-sm text-foreground">{selectedBank?.bank_name} - {selectedBank?.account_number}</p>
              <p className="text-xs text-muted-foreground">{selectedBank?.account_name}</p>
            </div>
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input type="number" min={MIN_WITHDRAWAL} max={walletBalance} placeholder={`Min. ${formatNaira(MIN_WITHDRAWAL)}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">Available: {formatNaira(walletBalance)} · Min: {formatNaira(MIN_WITHDRAWAL)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("bank_select")} className="flex-1">Back</Button>
              <Button onClick={initiateWithdrawal} disabled={!amount} className="flex-1">Continue</Button>
            </div>
          </div>
        )}

        {/* ── Paystack: confirm ── */}
        {step === "confirm" && (
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm text-muted-foreground">You're about to withdraw</p>
            <p className="text-3xl font-bold text-primary">{formatNaira(parseFloat(amount))}</p>
            <p className="text-sm text-muted-foreground">to {selectedBank?.bank_name} - {selectedBank?.account_number}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("amount")} className="flex-1">Back</Button>
              <Button onClick={confirmWithdrawal} className="flex-1">Confirm Withdrawal</Button>
            </div>
          </div>
        )}

        {/* ── Stripe: checking connect status ── */}
        {step === "stripe_check" && (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Checking your Stripe account...</p>
          </div>
        )}

        {/* ── Stripe: onboarding needed ── */}
        {step === "stripe_onboard" && (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
              <Link className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {!stripeStatus?.connected
                    ? "Connect an international bank account"
                    : "Complete your Stripe account setup"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {!stripeStatus?.connected
                    ? "Link your bank account via Stripe to receive international payouts in your local currency."
                    : "Your Stripe account isn't fully verified yet. Complete onboarding to enable payouts."}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("method_select")} className="flex-1">Back</Button>
              <Button onClick={handleStripeOnboard} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {!stripeStatus?.connected ? "Connect with Stripe" : "Resume Setup"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Stripe: amount entry ── */}
        {step === "stripe_amount" && (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground">Payout via Stripe Connect</p>
              <p className="text-sm font-medium text-foreground">
                Funds will be converted from NGN to USD at settlement rate.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input
                type="number"
                min={MIN_WITHDRAWAL}
                max={walletBalance}
                placeholder={`Min. ${formatNaira(MIN_WITHDRAWAL)}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Available: {formatNaira(walletBalance)} · Min: {formatNaira(MIN_WITHDRAWAL)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("method_select")} className="flex-1">Back</Button>
              <Button onClick={initiateStripePayout_} disabled={!amount} className="flex-1">Continue</Button>
            </div>
          </div>
        )}

        {/* ── Stripe: confirm ── */}
        {step === "stripe_confirm" && (
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm text-muted-foreground">You're about to request a payout of</p>
            <p className="text-3xl font-bold text-primary">{formatNaira(parseFloat(amount))}</p>
            {stripeUsdEquivalent && (
              <p className="text-sm text-muted-foreground">
                ≈ ${stripeUsdEquivalent} USD · exact rate applied at settlement
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Funds will be sent to your connected Stripe account · 2–5 business days
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("stripe_amount")} className="flex-1">Back</Button>
              <Button onClick={confirmStripePayout} className="flex-1">Confirm Payout</Button>
            </div>
          </div>
        )}

        {/* ── Shared: processing ── */}
        {step === "processing" && (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Processing withdrawal...</p>
          </div>
        )}

        {/* ── Shared: success ── */}
        {step === "success" && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <p className="font-semibold text-foreground">
              {payoutMethod === "stripe" ? "Payout Initiated!" : "Withdrawal Initiated!"}
            </p>
            <p className="text-sm text-muted-foreground">
              {payoutMethod === "stripe"
                ? `${formatNaira(parseFloat(amount))} is being sent to your Stripe account. Allow 2–5 business days.`
                : `${formatNaira(parseFloat(amount))} is being transferred to your bank account. It may take a few minutes.`}
            </p>
            <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}

        {/* ── Shared: failed ── */}
        {step === "failed" && (
          <div className="space-y-4 py-4 text-center">
            <p className="text-destructive font-semibold">
              {payoutMethod === "stripe" ? "Payout Failed" : "Withdrawal Failed"}
            </p>
            <p className="text-sm text-muted-foreground">Please try again or contact support.</p>
            <Button className="w-full" onClick={resetState}>Try Again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
