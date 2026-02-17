import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { toast } from "sonner";
import { Loader2, CreditCard, Building2, Smartphone } from "lucide-react";

interface FundWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userEmail?: string;
}

type ChargeStep = "amount" | "charging" | "pin" | "otp" | "phone" | "birthday" | "address" | "open_url" | "pay_offline" | "pending" | "success" | "failed";

export function FundWalletModal({ open, onOpenChange, onSuccess, userEmail }: FundWalletModalProps) {
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState("card");
  const [step, setStep] = useState<ChargeStep>("amount");
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState("");
  const [paystackData, setPaystackData] = useState<any>(null);

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");

  // Bank fields
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  // USSD
  const [ussdType, setUssdType] = useState("737");

  // Verification fields
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");

  const resetState = () => {
    setStep("amount");
    setAmount("");
    setReference("");
    setPaystackData(null);
    setPin("");
    setOtp("");
    setPhone("");
    setBirthday("");
    setCardNumber("");
    setExpMonth("");
    setExpYear("");
    setCvv("");
    setBankCode("");
    setAccountNumber("");
    setLoading(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const initiateCharge = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 100) {
      toast.error("Minimum amount is ₦100");
      return;
    }

    setLoading(true);
    const amountKobo = Math.round(numAmount * 100);

    const chargeBody: any = {
      action: "initiate",
      amount: amountKobo,
      channel,
      email: userEmail,
      purpose: "wallet_funding",
    };

    if (channel === "bank" && bankCode && accountNumber) {
      chargeBody.bank = { code: bankCode, account_number: accountNumber };
    }
    if (channel === "ussd") {
      chargeBody.ussd = { type: ussdType };
    }

    const { data, error } = await supabase.functions.invoke("paystack-charge", { body: chargeBody });

    setLoading(false);

    if (error || !data?.success) {
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
      case "send_pin":
        setStep("pin");
        break;
      case "send_otp":
        setStep("otp");
        break;
      case "send_phone":
        setStep("phone");
        break;
      case "send_birthday":
        setStep("birthday");
        break;
      case "send_address":
        setStep("address");
        break;
      case "open_url":
        setStep("open_url");
        break;
      case "pay_offline":
        setStep("pay_offline");
        break;
      case "pending":
        setStep("pending");
        break;
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
    const { data, error } = await supabase.functions.invoke("paystack-charge", {
      body: { action, reference, ...payload },
    });
    setLoading(false);

    if (error || !data?.success) {
      toast.error(data?.error || "Verification failed");
      return;
    }

    setPaystackData(data.data);
    handleStepTransition(data.status, data.data);
  };

  const checkPending = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("paystack-charge", {
      body: { action: "check_pending", reference },
    });
    setLoading(false);

    if (data) {
      handleStepTransition(data.status, data.data);
    }
  };

  const quickAmounts = [1000, 5000, 10000, 25000, 50000, 100000];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fund Wallet</DialogTitle>
          <DialogDescription>Add money to your wallet to fund contracts and milestones.</DialogDescription>
        </DialogHeader>

        {step === "amount" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input
                type="number"
                min="100"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((a) => (
                  <Button key={a} variant="outline" size="sm" onClick={() => setAmount(String(a))}>
                    {formatNaira(a)}
                  </Button>
                ))}
              </div>
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
                <p className="text-sm text-muted-foreground">You'll be prompted for card details by Paystack securely.</p>
              </TabsContent>

              <TabsContent value="bank" className="space-y-3">
                <div className="space-y-2">
                  <Label>Bank Code</Label>
                  <Input placeholder="e.g. 057" value={bankCode} onChange={(e) => setBankCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input placeholder="0000000000" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                </div>
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

            <Button className="w-full" onClick={initiateCharge} disabled={loading || !amount}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Pay {amount ? formatNaira(parseFloat(amount)) : ""}
            </Button>
          </div>
        )}

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

        {step === "open_url" && paystackData?.url && (
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm text-muted-foreground">Complete payment in the new window, then click below to verify.</p>
            <Button variant="outline" onClick={() => window.open(paystackData.url, "_blank")}>
              Open Payment Page
            </Button>
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
            <p className="text-sm text-muted-foreground">{formatNaira(parseFloat(amount))} has been added to your wallet.</p>
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
