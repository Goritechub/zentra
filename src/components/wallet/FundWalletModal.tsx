import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNaira } from "@/lib/nigerian-data";
import { toast } from "sonner";
import { Loader2, CreditCard, Building2, Smartphone, Globe } from "lucide-react";
import { api } from "@/api/axios";
import { createFundingIntent } from "@/api/stripe.api";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

const SUPPORTED_CURRENCIES = ["USD", "GBP", "EUR"] as const;
type ForeignCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const CURRENCY_SYMBOLS: Record<ForeignCurrency, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
};

interface FundWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userEmail?: string;
}

type ChargeStep =
  | "currency_select"
  | "amount"
  | "charging"
  | "pin"
  | "otp"
  | "phone"
  | "birthday"
  | "address"
  | "open_url"
  | "pay_offline"
  | "pending"
  | "stripe_form"
  | "success"
  | "failed";

// ── Stripe payment form (must live inside <Elements>) ──────────────────────

interface StripePaymentFormProps {
  amountDisplay: string;
  currency: ForeignCurrency;
  ngnEquivalent: number | null;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function StripePaymentForm({
  amountDisplay,
  currency,
  ngnEquivalent,
  onSuccess,
  onError,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Stripe redirects here on success for redirect-based payment methods.
        // Card payments complete without a redirect, so this is a safe fallback.
        return_url: `${window.location.origin}/wallet?stripe_success=1`,
      },
      redirect: "if_required",
    });

    setLoading(false);

    if (error) {
      onError(error.message || "Payment failed");
    } else {
      // No redirect means payment succeeded immediately (e.g. card)
      toast.success("Payment successful! Your wallet will be credited shortly.");
      onSuccess();
    }
  };

  return (
    <div className="space-y-4">
      {ngnEquivalent && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
          <p className="text-xs text-muted-foreground">Approximate wallet credit</p>
          <p className="text-lg font-semibold text-foreground">{formatNaira(ngnEquivalent)}</p>
          <p className="text-xs text-muted-foreground">
            at today's rate · final amount confirmed at settlement
          </p>
        </div>
      )}
      <PaymentElement />
      <Button className="w-full" onClick={handlePay} disabled={!stripe || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Pay {CURRENCY_SYMBOLS[currency]}{amountDisplay}
      </Button>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────

export function FundWalletModal({ open, onOpenChange, onSuccess, userEmail }: FundWalletModalProps) {
  // Provider selection
  const [paymentCurrency, setPaymentCurrency] = useState<"NGN" | ForeignCurrency>("NGN");

  // Paystack state
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState("card");
  const [step, setStep] = useState<ChargeStep>("currency_select");
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState("");
  const [paystackData, setPaystackData] = useState<any>(null);
  const [ussdType, setUssdType] = useState("737");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");

  // Stripe state
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripeNgnEquivalent, setStripeNgnEquivalent] = useState<number | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  const resetState = () => {
    setStep("currency_select");
    setPaymentCurrency("NGN");
    setAmount("");
    setReference("");
    setPaystackData(null);
    setPin(""); setOtp(""); setPhone(""); setBirthday("");
    setLoading(false);
    setStripeClientSecret(null);
    setStripeNgnEquivalent(null);
    setStripeLoading(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  // ── Currency / amount selection step ──

  const handleContinueToPayment = async () => {
    const numAmount = parseFloat(amount);

    if (paymentCurrency === "NGN") {
      // Existing Paystack flow
      if (!numAmount || numAmount < 100) {
        toast.error("Minimum amount is ₦100");
        return;
      }
      setStep("amount");
    } else {
      // Stripe flow
      if (!numAmount || numAmount < 1) {
        toast.error(`Minimum amount is ${CURRENCY_SYMBOLS[paymentCurrency]}1`);
        return;
      }
      setStripeLoading(true);
      try {
        const amountCents = Math.round(numAmount * 100);
        const result = await createFundingIntent(amountCents, paymentCurrency.toLowerCase());
        setStripeClientSecret(result.clientSecret);
        setStripeNgnEquivalent(result.ngnEquivalent);
        setStep("stripe_form");
      } catch (err: any) {
        toast.error(err?.message || "Failed to initiate payment");
      } finally {
        setStripeLoading(false);
      }
    }
  };

  // ── Paystack charge ──

  const initiateCharge = async () => {
    const numAmount = parseFloat(amount);
    setLoading(true);
    const amountKobo = Math.round(numAmount * 100);

    const chargeBody: any = {
      action: "initiate",
      amount: amountKobo,
      channel,
      email: userEmail,
      purpose: "wallet_funding",
    };

    if (channel === "ussd") {
      chargeBody.ussd = { type: ussdType };
    }

    let data: any;
    try {
      const res = await api.post("/wallet/paystack-charge", chargeBody);
      data = res.data;
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Failed to initiate payment");
      return;
    }

    setLoading(false);
    if (!data?.success) {
      toast.error(data?.error || "Failed to initiate payment");
      return;
    }

    setReference(data.reference);
    setPaystackData(data.data);
    handleStepTransition(data.status, data.data);
  };

  const handleStepTransition = (status: string, data?: any) => {
    switch (status) {
      case "success":
        setStep("success");
        toast.success("Payment successful! Wallet funded.");
        onSuccess();
        break;
      case "send_pin":    setStep("pin");        break;
      case "send_otp":    setStep("otp");        break;
      case "send_phone":  setStep("phone");      break;
      case "send_birthday": setStep("birthday"); break;
      case "send_address":  setStep("address");  break;
      case "open_url":
        setStep("open_url");
        if (data?.url) window.open(data.url, "_blank");
        break;
      case "pay_offline": setStep("pay_offline"); break;
      case "pending":     setStep("pending");     break;
      case "failed":
        setStep("failed");
        toast.error("Payment failed");
        break;
      default:
        setStep("pending");
    }
  };

  const submitVerification = async (action: string, payload: Record<string, string>) => {
    setLoading(true);
    try {
      const res = await api.post("/wallet/paystack-charge", { action, reference, ...payload });
      const data = res.data;
      if (!data?.success) {
        toast.error(data?.error || "Verification failed");
        return;
      }
      setPaystackData(data.data);
      handleStepTransition(data.status, data.data);
    } catch (err: any) {
      toast.error(err?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const checkPending = async () => {
    setLoading(true);
    try {
      const res = await api.post("/wallet/paystack-charge", { action: "check_pending", reference });
      const data = res.data;
      if (!data) {
        toast.error("Could not verify payment status. Please try again.");
        return;
      }
      handleStepTransition(data.status, data.data);
    } catch (err: any) {
      toast.error(err?.message || "Could not verify payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const quickAmountsNgn = [1000, 5000, 10000, 25000, 50000, 100000];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fund Wallet</DialogTitle>
          <DialogDescription>Add money to your wallet to fund contracts and milestones.</DialogDescription>
        </DialogHeader>

        {/* ── Currency + Amount selection ── */}
        {step === "currency_select" && (
          <div className="space-y-4 py-2">
            {/* Currency selector */}
            <div className="space-y-2">
              <Label>Payment currency</Label>
              <div className="flex gap-2 flex-wrap">
                {(["NGN", ...SUPPORTED_CURRENCIES] as const).map((cur) => (
                  <button
                    key={cur}
                    onClick={() => { setPaymentCurrency(cur); setAmount(""); }}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      paymentCurrency === cur
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
              {paymentCurrency !== "NGN" && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Powered by Stripe · card, Apple Pay, Google Pay accepted
                </p>
              )}
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <Label>
                Amount ({paymentCurrency === "NGN" ? "₦" : CURRENCY_SYMBOLS[paymentCurrency]})
              </Label>
              <Input
                type="number"
                min={paymentCurrency === "NGN" ? "100" : "1"}
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {paymentCurrency === "NGN" && (
                <div className="flex flex-wrap gap-2">
                  {quickAmountsNgn.map((a) => (
                    <Button key={a} variant="outline" size="sm" onClick={() => setAmount(String(a))}>
                      {formatNaira(a)}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleContinueToPayment}
              disabled={!amount || stripeLoading}
            >
              {stripeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Continue
            </Button>
          </div>
        )}

        {/* ── Stripe Payment Element ── */}
        {step === "stripe_form" && stripeClientSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: stripeClientSecret,
              appearance: { theme: "stripe" },
            }}
          >
            <StripePaymentForm
              amountDisplay={amount}
              currency={paymentCurrency as ForeignCurrency}
              ngnEquivalent={stripeNgnEquivalent}
              onSuccess={() => { setStep("success"); onSuccess(); }}
              onError={(msg) => { toast.error(msg); setStep("failed"); }}
            />
          </Elements>
        )}

        {/* ── Paystack: channel selection ── */}
        {step === "amount" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount: {formatNaira(parseFloat(amount) || 0)}</Label>
            </div>

            <Tabs value={channel} onValueChange={setChannel}>
              <TabsList className="w-full">
                <TabsTrigger value="card" className="flex-1 gap-1">
                  <CreditCard className="h-3 w-3" /> Card
                </TabsTrigger>
                <TabsTrigger value="bank" className="flex-1 gap-1">
                  <Building2 className="h-3 w-3" /> Bank
                </TabsTrigger>
                <TabsTrigger value="ussd" className="flex-1 gap-1">
                  <Smartphone className="h-3 w-3" /> USSD
                </TabsTrigger>
              </TabsList>

              <TabsContent value="card">
                <p className="text-sm text-muted-foreground">You'll be redirected to Paystack's secure checkout page to enter your card details.</p>
              </TabsContent>
              <TabsContent value="bank">
                <p className="text-sm text-muted-foreground">You'll be redirected to Paystack's secure page for bank transfer payment.</p>
              </TabsContent>
              <TabsContent value="ussd">
                <div className="space-y-2">
                  <Label>USSD Type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={ussdType}
                    onChange={(e) => setUssdType(e.target.value)}
                  >
                    <option value="737">GTBank (*737#)</option>
                    <option value="919">UBA (*919#)</option>
                    <option value="822">Sterling (*822#)</option>
                    <option value="966">Zenith (*966#)</option>
                  </select>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("currency_select")} className="flex-1">Back</Button>
              <Button onClick={initiateCharge} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Pay {formatNaira(parseFloat(amount))}
              </Button>
            </div>
          </div>
        )}

        {/* ── Paystack verification steps (unchanged) ── */}
        {step === "pin" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Enter your card PIN to continue.</p>
            <Input type="password" maxLength={4} placeholder="****" value={pin} onChange={(e) => setPin(e.target.value)} />
            <Button className="w-full" onClick={() => submitVerification("submit_pin", { pin })} disabled={loading || pin.length < 4}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit PIN
            </Button>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Enter the OTP sent to your phone/email.</p>
            <Input placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
            <Button className="w-full" onClick={() => submitVerification("submit_otp", { otp })} disabled={loading || !otp}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit OTP
            </Button>
          </div>
        )}

        {step === "phone" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Enter your phone number to continue.</p>
            <Input placeholder="08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button className="w-full" onClick={() => submitVerification("submit_phone", { phone })} disabled={loading || !phone}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Phone
            </Button>
          </div>
        )}

        {step === "birthday" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Enter your birthday to verify your identity.</p>
            <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            <Button className="w-full" onClick={() => submitVerification("submit_birthday", { birthday })} disabled={loading || !birthday}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Birthday
            </Button>
          </div>
        )}

        {step === "open_url" && (
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm text-muted-foreground">Complete payment in the new window, then click below to verify.</p>
            {paystackData?.url && (
              <Button variant="outline" onClick={() => window.open(paystackData.url, "_blank")}>
                Open Payment Page
              </Button>
            )}
            <Button className="w-full" onClick={checkPending} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              I've Completed Payment
            </Button>
          </div>
        )}

        {step === "pay_offline" && (
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm text-muted-foreground">
              Dial the USSD code on your phone to complete payment, then click below.
            </p>
            {paystackData?.display_text && (
              <p className="font-mono text-lg text-foreground">{paystackData.display_text}</p>
            )}
            <Button className="w-full" onClick={checkPending} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              I've Completed Payment
            </Button>
          </div>
        )}

        {step === "pending" && (
          <div className="space-y-4 py-2 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Payment is being processed...</p>
            <Button className="w-full" onClick={checkPending} disabled={loading}>
              Check Status
            </Button>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4 py-2 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <p className="font-semibold text-foreground">Payment Successful!</p>
            {paymentCurrency === "NGN" ? (
              <p className="text-sm text-muted-foreground">{formatNaira(parseFloat(amount))} has been added to your wallet.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {CURRENCY_SYMBOLS[paymentCurrency as ForeignCurrency]}{amount} received · your wallet will be credited after confirmation.
              </p>
            )}
            <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}

        {step === "failed" && (
          <div className="space-y-4 py-2 text-center">
            <p className="text-destructive font-semibold">Payment Failed</p>
            <p className="text-sm text-muted-foreground">{paystackData?.gateway_response || "Please try again."}</p>
            <Button className="w-full" onClick={resetState}>Try Again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
