import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/api/axios";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "sonner";
import { Loader2, Building2, CheckCircle2, AlertTriangle } from "lucide-react";
import { initiatePayout } from "@/api/flutterwave.api";
import type { BankDetail, PaystackBank } from "@/types/wallet";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  walletBalance: number;
  userId: string;
  userName?: string;
}

const MIN_WITHDRAWAL = 5000;

type FlwCurrency = "NGN" | "USD" | "GBP" | "EUR" | "GHS" | "KES";

const FLW_CURRENCIES: { value: FlwCurrency; label: string; flag: string; desc: string }[] = [
  { value: "NGN", flag: "🇳🇬", label: "NGN — Nigerian Naira",      desc: "Domestic bank transfer" },
  { value: "USD", flag: "🇺🇸", label: "USD — US Dollar",           desc: "US bank · SWIFT + routing number" },
  { value: "GBP", flag: "🇬🇧", label: "GBP — British Pound",       desc: "UK bank · SWIFT + sort code" },
  { value: "EUR", flag: "🇪🇺", label: "EUR — Euro",                desc: "European bank · BIC + IBAN" },
  { value: "GHS", flag: "🇬🇭", label: "GHS — Ghanaian Cedi",       desc: "Ghanaian bank transfer" },
  { value: "KES", flag: "🇰🇪", label: "KES — Kenyan Shilling",     desc: "Kenyan bank · M-Pesa supported" },
];

type Step =
  | "method_select"
  | "bank_select"
  | "add_bank"
  | "amount"
  | "confirm"
  | "flw_currency"
  | "flw_details"
  | "flw_amount"
  | "flw_confirm"
  | "processing"
  | "success"
  | "failed";

type PayoutMethod = "paystack" | "flutterwave";

export function WithdrawModal({ open, onOpenChange, onSuccess, walletBalance, userId, userName }: WithdrawModalProps) {
  const { format, rates } = useCurrency();
  const [step, setStep] = useState<Step>("method_select");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("paystack");
  const [loading, setLoading] = useState(false);

  // Paystack state
  const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
  const [selectedBank, setSelectedBank] = useState<BankDetail | null>(null);
  const [amount, setAmount] = useState("");
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [nameMismatch, setNameMismatch] = useState(false);
  const [selectedBankName, setSelectedBankName] = useState("");

  // Flutterwave state
  const [flwCurrency, setFlwCurrency] = useState<FlwCurrency>("NGN");
  const [flwBankCode, setFlwBankCode] = useState("");
  const [flwAccountNumber, setFlwAccountNumber] = useState("");
  const [flwAccountName, setFlwAccountName] = useState("");
  const [flwSelectedBankName, setFlwSelectedBankName] = useState("");
  const [flwResolving, setFlwResolving] = useState(false);
  // International-only fields
  const [flwSwift, setFlwSwift] = useState("");
  const [flwBranchCode, setFlwBranchCode] = useState(""); // routing (USD) or sort code (GBP)
  const [flwIban, setFlwIban] = useState("");             // EUR
  const [ngnDeducted, setNgnDeducted] = useState<number | null>(null);

  useEffect(() => {
    if (open) fetchBankDetails();
  }, [open]);

  const fetchBankDetails = async () => {
    try {
      const res = await api.post("/wallet/paystack-transfer", { action: "list_bank_details" });
      if (res.data?.success) {
        const details = res.data.bank_details as BankDetail[];
        setBankDetails(details);
        if (details.length > 0) setSelectedBank(details[0]);
      }
    } catch {
      toast.error("Failed to load bank details");
    }
  };

  const fetchBanks = async () => {
    if (banks.length > 0) return;
    setLoading(true);
    try {
      const res = await api.post("/wallet/paystack-transfer", { action: "list_banks" });
      if (res.data?.banks) {
        const seen = new Set<string>();
        const unique = (res.data.banks as PaystackBank[]).filter((b) => {
          if (seen.has(b.code)) return false;
          seen.add(b.code);
          return true;
        });
        setBanks(unique);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  // ── Paystack helpers ──

  const resolveAccount = async () => {
    if (accountNumber.length !== 10 || !bankCode) return;
    setResolving(true);
    try {
      const res = await api.post("/wallet/paystack-transfer", { action: "resolve_account", account_number: accountNumber, bank_code: bankCode });
      if (res.data?.success && res.data.data?.account_name) {
        const resolved = res.data.data.account_name as string;
        setResolvedName(resolved);
        if (userName) {
          const norm = (s: string) => s.toLowerCase().trim().split(/\s+/).filter(p => p.length >= 2);
          const profileParts = norm(userName);
          const bankParts = norm(resolved);
          const matches = profileParts.filter(p => bankParts.includes(p)).length;
          setNameMismatch(matches < 2);
        } else {
          setNameMismatch(false);
        }
      } else {
        toast.error("Could not resolve account. Check details.");
        setResolvedName("");
        setNameMismatch(false);
      }
    } catch {
      toast.error("Could not resolve account.");
      setResolvedName("");
      setNameMismatch(false);
    }
    setResolving(false);
  };

  const saveBankDetails = async () => {
    if (!resolvedName || !bankCode || !accountNumber) { toast.error("Please resolve your account first"); return; }
    setLoading(true);
    try {
      const res = await api.post("/wallet/paystack-transfer", {
        action: "save_bank", account_number: accountNumber, bank_code: bankCode, bank_name: selectedBankName, account_name: resolvedName,
      });
      if (res.data?.success) {
        toast.success("Bank account saved");
        const saved = res.data.bank_detail as BankDetail;
        setBankDetails((prev) => {
          const without = prev.filter((b) => b.id !== saved.id);
          return [saved, ...without];
        });
        setSelectedBank(saved);
        setStep("amount");
        setBankCode(""); setAccountNumber(""); setResolvedName("");
      } else {
        toast.error(res.data?.error || "Failed to save bank details");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save bank details");
    }
    setLoading(false);
  };

  const initiateWithdrawal = () => {
    const n = parseFloat(amount);
    if (!n || n < MIN_WITHDRAWAL) { toast.error(`Minimum withdrawal is ${format(MIN_WITHDRAWAL)}.`); return; }
    if (n > walletBalance) { toast.error("Insufficient balance"); return; }
    setStep("confirm");
  };

  const confirmWithdrawal = async () => {
    setStep("processing");
    setLoading(true);
    try {
      const res = await api.post("/wallet/paystack-transfer", { action: "withdraw", amount: parseFloat(amount), bank_detail_id: selectedBank?.id });
      setLoading(false);
      if (res.data?.success) { setStep("success"); toast.success("Withdrawal initiated!"); onSuccess(); }
      else { setStep("failed"); toast.error(res.data?.error || "Withdrawal failed"); }
    } catch (err) {
      setLoading(false); setStep("failed"); toast.error(err instanceof Error ? err.message : "Withdrawal failed");
    }
  };

  // ── Flutterwave NGN account resolve ──

  const resolveFlwNgnAccount = async () => {
    if (flwAccountNumber.length !== 10 || !flwBankCode) return;
    setFlwResolving(true);
    try {
      const res = await api.post("/wallet/paystack-transfer", { action: "resolve_account", account_number: flwAccountNumber, bank_code: flwBankCode });
      if (res.data?.success && res.data.data?.account_name) {
        setFlwAccountName(res.data.data.account_name);
      } else {
        toast.error("Could not resolve account. Check details.");
        setFlwAccountName("");
      }
    } catch {
      toast.error("Could not resolve account.");
      setFlwAccountName("");
    }
    setFlwResolving(false);
  };

  const flwDetailsComplete = (): boolean => {
    switch (flwCurrency) {
      case "NGN":
      case "GHS":
      case "KES":
        return !!(flwBankCode && flwAccountNumber && flwAccountName);
      case "USD":
        return !!(flwSwift && flwAccountNumber && flwAccountName && flwBranchCode);
      case "GBP":
        return !!(flwSwift && flwAccountNumber && flwAccountName && flwBranchCode);
      case "EUR":
        return !!(flwSwift && flwIban && flwAccountName);
    }
  };

  const initiateFlwPayout = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) { toast.error("Enter a valid amount."); return; }

    if (flwCurrency === "NGN") {
      if (n < MIN_WITHDRAWAL) { toast.error(`Minimum payout is ${format(MIN_WITHDRAWAL)}.`); return; }
      if (n > walletBalance) { toast.error("Insufficient balance"); return; }
    } else {
      const rate = getFxRate();
      if (!rate) { toast.error("FX rate unavailable. Please try again."); return; }
      const ngnEquivalent = Math.ceil(n / rate);
      if (ngnEquivalent < MIN_WITHDRAWAL) {
        toast.error(`Minimum payout is ₦${MIN_WITHDRAWAL.toLocaleString()} equivalent.`);
        return;
      }
      if (ngnEquivalent > walletBalance) { toast.error("Insufficient balance"); return; }
    }
    setStep("flw_confirm");
  };

  const confirmFlwPayout = async () => {
    setStep("processing");
    setLoading(true);
    try {
      const bankCodeToUse = flwCurrency === "EUR" ? flwSwift : (["USD", "GBP"].includes(flwCurrency) ? flwSwift : flwBankCode);
      const accountNumberToUse = flwCurrency === "EUR" ? flwIban : flwAccountNumber;

      const result = await initiatePayout({
        amount: parseFloat(amount),
        currency: flwCurrency,
        bankCode: bankCodeToUse,
        accountNumber: accountNumberToUse,
        accountName: flwAccountName,
        narration: `ZentraGig withdrawal to ${flwAccountName}`,
        destinationBranchCode: ["USD", "GBP"].includes(flwCurrency) ? flwBranchCode : undefined,
      });
      setNgnDeducted(result.ngn_deducted);
      setLoading(false);
      setStep("success");
      toast.success("Payout initiated! Funds will be sent to your account.");
      onSuccess();
    } catch (err) {
      setLoading(false); setStep("failed"); toast.error(err instanceof Error ? err.message : "Payout failed");
    }
  };

  const resetState = () => {
    setStep("method_select"); setPayoutMethod("paystack"); setAmount("");
    setSelectedBank(null); setResolvedName(""); setBankCode(""); setAccountNumber("");
    setFlwCurrency("NGN"); setFlwBankCode(""); setFlwAccountNumber(""); setFlwAccountName("");
    setFlwSelectedBankName(""); setFlwSwift(""); setFlwBranchCode(""); setFlwIban("");
    setNgnDeducted(null); setLoading(false);
  };

  const handleClose = (v: boolean) => { if (!v) resetState(); onOpenChange(v); };

  const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", GBP: "£", EUR: "€", GHS: "₵", KES: "KSh" };
  const RATE_KEYS: Record<string, keyof typeof rates> = {
    USD: "NGN_USD", GBP: "NGN_GBP", EUR: "NGN_EUR", GHS: "NGN_GHS", KES: "NGN_KES",
  };

  const getFxRate = (): number | null => {
    const key = RATE_KEYS[flwCurrency];
    return key ? (rates[key] as number | null) : null;
  };

  const belowMinimum = walletBalance < MIN_WITHDRAWAL;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Withdraw Funds</DialogTitle>
          <DialogDescription>Transfer funds from your wallet to your bank account.</DialogDescription>
        </DialogHeader>

        {belowMinimum && step === "method_select" && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/5">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Minimum withdrawal is {format(MIN_WITHDRAWAL)}.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your balance is {format(walletBalance)}. You need at least {format(MIN_WITHDRAWAL)} to withdraw.
              </p>
            </div>
          </div>
        )}

        {/* ── Method selection ── */}
        {step === "method_select" && !belowMinimum && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Available: <strong>{format(walletBalance)}</strong></p>
            <div className="space-y-2">
              <Label>Payout method</Label>
              <button
                onClick={() => {
                  setPayoutMethod("paystack");
                  if (bankDetails.length > 0) {
                    setStep("bank_select");
                  } else {
                    fetchBanks();
                    setStep("add_bank");
                  }
                }}
                className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground text-sm">Nigerian Bank Account</p>
                    <p className="text-xs text-muted-foreground">NGN withdrawal · processed by admin · 1–2 business days</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => { setPayoutMethod("flutterwave"); setStep("flw_currency"); }}
                className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium text-foreground text-sm">Flutterwave Transfer</p>
                    <p className="text-xs text-muted-foreground">NGN · USD · GBP · EUR · GHS · KES · 1–3 business days</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Paystack: bank select ── */}
        {step === "bank_select" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Available: <strong>{format(walletBalance)}</strong></p>
            {bankDetails.length > 0 ? (
              <div className="space-y-2">
                <Label>Select Bank Account</Label>
                {bankDetails.map((bd) => (
                  <button key={bd.id} onClick={() => { setSelectedBank(bd); setStep("amount"); }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedBank?.id === bd.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground text-sm">{bd.bank_name}</p>
                        <p className="text-xs text-muted-foreground">{bd.account_number} · {bd.account_name}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No saved bank accounts. Add one below.</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("method_select")} className="flex-1">Back</Button>
              <Button variant="outline" onClick={() => { fetchBanks(); setStep("add_bank"); }} className="flex-1">+ Add Bank</Button>
            </div>
          </div>
        )}

        {/* ── Paystack: add bank ── */}
        {step === "add_bank" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Bank</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={bankCode}
                onChange={(e) => { setBankCode(e.target.value); setSelectedBankName(banks.find((b) => b.code === e.target.value)?.name || ""); setResolvedName(""); }}
              >
                <option value="">Select bank...</option>
                {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input maxLength={10} placeholder="0000000000" value={accountNumber}
                onChange={(e) => { setAccountNumber(e.target.value); setResolvedName(""); }} />
            </div>
            {accountNumber.length === 10 && bankCode && !resolvedName && (
              <Button variant="outline" size="sm" onClick={resolveAccount} disabled={resolving}>
                {resolving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Verify Account
              </Button>
            )}
            {resolvedName && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm font-medium text-foreground">{resolvedName}</p>
                <p className="text-xs text-muted-foreground">{selectedBankName} · {accountNumber}</p>
              </div>
            )}
            {nameMismatch && resolvedName && (
              <div className="flex gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  The account name <strong>{resolvedName}</strong> doesn't closely match your profile name <strong>{userName}</strong>. Make sure this account belongs to you before continuing.
                </span>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("bank_select")} className="flex-1">Back</Button>
              <Button onClick={saveBankDetails} disabled={loading || !resolvedName} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save & Continue
              </Button>
            </div>
          </div>
        )}

        {/* ── Paystack: amount ── */}
        {step === "amount" && payoutMethod === "paystack" && (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">Withdraw to</p>
              <p className="font-medium text-sm text-foreground">{selectedBank?.bank_name} · {selectedBank?.account_number}</p>
              <p className="text-xs text-muted-foreground">{selectedBank?.account_name}</p>
            </div>
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input type="number" min={MIN_WITHDRAWAL} max={walletBalance}
                placeholder={`Min. ${format(MIN_WITHDRAWAL)}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">Available: {format(walletBalance)} · Min: {format(MIN_WITHDRAWAL)}</p>
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
            <p className="text-3xl font-bold text-primary">{format(parseFloat(amount))}</p>
            <p className="text-sm text-muted-foreground">to {selectedBank?.bank_name} · {selectedBank?.account_number}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("amount")} className="flex-1">Back</Button>
              <Button onClick={confirmWithdrawal} className="flex-1">Confirm</Button>
            </div>
          </div>
        )}

        {/* ── Flutterwave: currency select ── */}
        {step === "flw_currency" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Available: <strong>{format(walletBalance)}</strong></p>
            <Label>Payout currency</Label>
            <div className="space-y-2">
              {FLW_CURRENCIES.map((c) => (
                <button key={c.value}
                  onClick={() => {
                    setFlwCurrency(c.value);
                    if (c.value === "NGN" || c.value === "GHS" || c.value === "KES") fetchBanks();
                    setStep("flw_details");
                  }}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{c.flag}</span>
                    <div>
                      <p className="font-medium text-foreground text-sm">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => setStep("method_select")} className="w-full">Back</Button>
          </div>
        )}

        {/* ── Flutterwave: bank details (form varies by currency) ── */}
        {step === "flw_details" && (
          <div className="space-y-4 py-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {FLW_CURRENCIES.find(c => c.value === flwCurrency)?.flag} {flwCurrency} Bank Details
            </p>

            {/* NGN / GHS / KES — domestic-style (bank dropdown + account number) */}
            {(flwCurrency === "NGN" || flwCurrency === "GHS" || flwCurrency === "KES") && (
              <>
                <div className="space-y-2">
                  <Label>Bank</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={flwBankCode}
                    onChange={(e) => {
                      setFlwBankCode(e.target.value);
                      setFlwSelectedBankName(banks.find((b) => b.code === e.target.value)?.name || "");
                      setFlwAccountName("");
                    }}
                  >
                    <option value="">Select bank...</option>
                    {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input maxLength={10} placeholder="0000000000" value={flwAccountNumber}
                    onChange={(e) => { setFlwAccountNumber(e.target.value); setFlwAccountName(""); }} />
                </div>
                {flwAccountNumber.length === 10 && flwBankCode && !flwAccountName && (
                  <Button variant="outline" size="sm" onClick={resolveFlwNgnAccount} disabled={flwResolving}>
                    {flwResolving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Verify Account
                  </Button>
                )}
                {flwAccountName && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm font-medium text-foreground">{flwAccountName}</p>
                    <p className="text-xs text-muted-foreground">{flwSelectedBankName} · {flwAccountNumber}</p>
                  </div>
                )}
              </>
            )}

            {/* USD — SWIFT + account number + routing number */}
            {flwCurrency === "USD" && (
              <>
                <div className="space-y-2">
                  <Label>Beneficiary Name</Label>
                  <Input placeholder="Full legal name" value={flwAccountName} onChange={(e) => setFlwAccountName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Bank SWIFT / BIC Code</Label>
                  <Input placeholder="e.g. CHASUS33" value={flwSwift} onChange={(e) => setFlwSwift(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input placeholder="Bank account number" value={flwAccountNumber} onChange={(e) => setFlwAccountNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>ABA Routing Number</Label>
                  <Input placeholder="9-digit routing number" maxLength={9} value={flwBranchCode} onChange={(e) => setFlwBranchCode(e.target.value)} />
                </div>
              </>
            )}

            {/* GBP — SWIFT + account number + sort code */}
            {flwCurrency === "GBP" && (
              <>
                <div className="space-y-2">
                  <Label>Beneficiary Name</Label>
                  <Input placeholder="Full legal name" value={flwAccountName} onChange={(e) => setFlwAccountName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Bank SWIFT / BIC Code</Label>
                  <Input placeholder="e.g. BARCGB22" value={flwSwift} onChange={(e) => setFlwSwift(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input placeholder="8-digit account number" value={flwAccountNumber} onChange={(e) => setFlwAccountNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Sort Code</Label>
                  <Input placeholder="e.g. 20-00-00" maxLength={8} value={flwBranchCode} onChange={(e) => setFlwBranchCode(e.target.value)} />
                </div>
              </>
            )}

            {/* EUR — BIC + IBAN */}
            {flwCurrency === "EUR" && (
              <>
                <div className="space-y-2">
                  <Label>Beneficiary Name</Label>
                  <Input placeholder="Full legal name" value={flwAccountName} onChange={(e) => setFlwAccountName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>BIC / SWIFT Code</Label>
                  <Input placeholder="e.g. DEUTDEDB" value={flwSwift} onChange={(e) => setFlwSwift(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-2">
                  <Label>IBAN</Label>
                  <Input placeholder="e.g. DE89370400440532013000" value={flwIban} onChange={(e) => setFlwIban(e.target.value.toUpperCase())} />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("flw_currency")} className="flex-1">Back</Button>
              <Button onClick={() => setStep("flw_amount")} disabled={!flwDetailsComplete()} className="flex-1">Continue</Button>
            </div>
          </div>
        )}

        {/* ── Flutterwave: amount ── */}
        {step === "flw_amount" && (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">Sending to · {flwCurrency}</p>
              <p className="font-medium text-sm text-foreground">{flwAccountName}</p>
              <p className="text-xs text-muted-foreground">
                {flwCurrency === "EUR" ? flwIban : flwAccountNumber}
                {flwSelectedBankName ? ` · ${flwSelectedBankName}` : (flwSwift ? ` · ${flwSwift}` : "")}
              </p>
            </div>

            <div className="space-y-2">
              {flwCurrency === "NGN" ? (
                <>
                  <Label>Amount (₦)</Label>
                  <Input type="number" min={MIN_WITHDRAWAL} max={walletBalance}
                    placeholder={`Min. ₦${MIN_WITHDRAWAL.toLocaleString()}`}
                    value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Available: {format(walletBalance)} · Min: {format(MIN_WITHDRAWAL)}
                  </p>
                </>
              ) : (() => {
                const rate = getFxRate();
                const sym = CURRENCY_SYMBOLS[flwCurrency] ?? flwCurrency;
                const n = parseFloat(amount);
                const availForeign = rate ? (walletBalance * rate).toFixed(2) : null;
                const minForeign = rate ? (MIN_WITHDRAWAL * rate).toFixed(2) : null;
                const ngnEstimate = (n > 0 && rate) ? Math.ceil(n / rate) : null;
                return (
                  <>
                    <Label>Amount ({flwCurrency})</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                        {sym}
                      </span>
                      <Input type="number" min={0} step="0.01" className="pl-8"
                        placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Available: {availForeign ? `${sym}${availForeign} ${flwCurrency}` : format(walletBalance)}
                      {" · "}Min: {minForeign ? `${sym}${minForeign} ${flwCurrency}` : `₦${MIN_WITHDRAWAL.toLocaleString()}`}
                    </p>
                    {n > 0 && ngnEstimate && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
                        <p className="text-lg font-semibold text-primary">
                          {format(ngnEstimate)} deducted
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          at {sym}1 = {format(Math.round(1 / rate!))} · rate refreshes every 15 min
                        </p>
                      </div>
                    )}
                    {n > 0 && !rate && (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                        <p className="text-sm text-muted-foreground">
                          Deduction calculated at the settlement rate on the day of transfer.
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("flw_details")} className="flex-1">Back</Button>
              <Button onClick={initiateFlwPayout} disabled={!amount} className="flex-1">Continue</Button>
            </div>
          </div>
        )}

        {/* ── Flutterwave: confirm ── */}
        {step === "flw_confirm" && (
          <div className="space-y-4 py-2 text-center">
            {flwCurrency === "NGN" ? (
              <>
                <p className="text-sm text-muted-foreground">Deducting from wallet</p>
                <p className="text-3xl font-bold text-primary">{format(parseFloat(amount))}</p>
              </>
            ) : (() => {
              const rate = getFxRate();
              const sym = CURRENCY_SYMBOLS[flwCurrency] ?? "";
              const n = parseFloat(amount);
              const ngnEstimate = (rate && n > 0) ? Math.ceil(n / rate) : null;
              return (
                <>
                  <p className="text-sm text-muted-foreground">You're sending</p>
                  <p className="text-3xl font-bold text-primary">
                    {sym}{n.toFixed(2)} {flwCurrency}
                  </p>
                  {ngnEstimate && (
                    <p className="text-sm text-muted-foreground">
                      ≈ {format(ngnEstimate)} will be deducted from your wallet
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Final rate set at time of transfer</p>
                </>
              );
            })()}
            <p className="text-sm text-muted-foreground">to {flwAccountName}</p>
            <p className="text-xs text-muted-foreground">{flwCurrency === "EUR" ? flwIban : flwAccountNumber} · via Flutterwave</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("flw_amount")} className="flex-1">Back</Button>
              <Button onClick={confirmFlwPayout} className="flex-1">Confirm Payout</Button>
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
              {payoutMethod === "flutterwave" ? "Payout Initiated!" : "Withdrawal Initiated!"}
            </p>
            <p className="text-sm text-muted-foreground">
              {payoutMethod === "flutterwave" && flwCurrency !== "NGN" ? (
                <>
                  {CURRENCY_SYMBOLS[flwCurrency] ?? ""}{parseFloat(amount).toFixed(2)} {flwCurrency} is on its way
                  {ngnDeducted ? ` · ${format(ngnDeducted)} deducted` : ""}. Allow 1–3 business days.
                </>
              ) : (
                <>Your withdrawal request has been submitted. Funds will be sent to your bank account within 1–2 business days.</>
              )}
            </p>
            <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}

        {/* ── Shared: failed ── */}
        {step === "failed" && (
          <div className="space-y-4 py-4 text-center">
            <p className="text-destructive font-semibold">
              {payoutMethod === "flutterwave" ? "Payout Failed" : "Withdrawal Failed"}
            </p>
            <p className="text-sm text-muted-foreground">Please try again or contact support.</p>
            <Button className="w-full" onClick={resetState}>Try Again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
