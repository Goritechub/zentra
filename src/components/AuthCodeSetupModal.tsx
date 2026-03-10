import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthCodeInput } from "@/components/AuthCodeInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Check } from "lucide-react";

interface AuthCodeSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type Step = "enter" | "confirm" | "saving";

/**
 * Standalone auth code setup modal used when a sensitive action
 * is attempted without having an auth code configured.
 * Unlike AuthCodeSetupGuard, this one cannot be dismissed.
 */
export function AuthCodeSetupModal({ open, onOpenChange, onComplete }: AuthCodeSetupModalProps) {
  const [step, setStep] = useState<Step>("enter");
  const [code, setCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");

  const handleNext = () => {
    if (code.length !== 6) { toast.error("Please enter all 6 digits"); return; }
    setStep("confirm");
  };

  const handleConfirmAndSave = async () => {
    if (confirmCode.length !== 6) { toast.error("Please enter all 6 digits"); return; }
    if (code !== confirmCode) {
      toast.error("Codes do not match. Please try again.");
      setConfirmCode("");
      return;
    }
    setStep("saving");
    const { data, error } = await supabase.functions.invoke("auth-code", {
      body: { action: "set", code },
    });
    if (error || !data?.success) {
      toast.error(data?.error || "Failed to set authentication code");
      setStep("confirm");
      return;
    }
    toast.success("Authentication code set successfully!");
    setCode("");
    setConfirmCode("");
    setStep("enter");
    onComplete();
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      // Don't allow closing — user must set up code for sensitive action
      toast.error("You must set up a security code before proceeding with this action.");
      return;
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Security Code Required
          </DialogTitle>
          <DialogDescription>
            {step === "enter"
              ? "You need to set up a 6-digit security code before you can perform this action. This code protects your financial transactions."
              : "Please re-enter your code to confirm."}
          </DialogDescription>
        </DialogHeader>

        {step === "enter" && (
          <div className="space-y-5 py-2">
            <div className="bg-muted/50 rounded-lg border border-border p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">This code protects:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Funding milestones & escrow</li>
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Wallet withdrawals</li>
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Publishing contest winners</li>
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Changing payout details</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-3 text-center">Create your 6-digit code</p>
              <AuthCodeInput value={code} onChange={setCode} />
            </div>
            <div className="space-y-2">
              <Button className="w-full" onClick={handleNext} disabled={code.length !== 6}>
                Continue
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => {
                  setCode("");
                  setConfirmCode("");
                  setStep("enter");
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {(step === "confirm" || step === "saving") && (
          <div className="space-y-5 py-2">
            <div>
              <p className="text-sm font-medium text-foreground mb-3 text-center">Re-enter your 6-digit code to confirm</p>
              <AuthCodeInput value={confirmCode} onChange={setConfirmCode} disabled={step === "saving"} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setConfirmCode(""); setStep("enter"); }} disabled={step === "saving"}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleConfirmAndSave} disabled={step === "saving" || confirmCode.length !== 6}>
                {step === "saving" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Set Code
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
