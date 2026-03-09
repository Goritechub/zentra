import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthCodeInput } from "@/components/AuthCodeInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Check } from "lucide-react";

type Step = "loading" | "idle" | "enter" | "confirm" | "saving";

export function AuthCodeSetupGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("loading");
  const [code, setCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");

  useEffect(() => {
    if (!user) { setStep("idle"); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.functions.invoke("auth-code", {
        body: { action: "check" },
      });
      if (cancelled) return;
      if (data?.has_code) {
        setStep("idle");
      } else {
        setStep("enter");
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

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
    setStep("idle");
  };

  const isOpen = step === "enter" || step === "confirm" || step === "saving";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={() => {/* prevent close */}}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          hideCloseButton
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Set Up Transaction Security
            </DialogTitle>
            <DialogDescription>
              {step === "enter" || step === "saving"
                ? "Create a 6-digit authentication code to secure your transactions. This code will be required for wallet operations, escrow funding, and more."
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
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Deleting your account</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-3 text-center">Enter your 6-digit code</p>
                <AuthCodeInput value={code} onChange={setCode} />
              </div>
              <Button className="w-full" onClick={handleNext} disabled={code.length !== 6}>
                Continue
              </Button>
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
      {children}
    </>
  );
}
