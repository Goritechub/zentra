import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthCodeInput } from "@/components/AuthCodeInput";
import { AuthCodeSetupModal } from "@/components/AuthCodeSetupModal";
import { verifyAuthCode } from "@/api/auth.api";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

const AUTH_CODE_VERIFY_TIMEOUT_MS = 12000;

interface AuthCodeVerifyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  title?: string;
  description?: string;
}

export function AuthCodeVerifyModal({
  open,
  onOpenChange,
  onVerified,
  title = "Enter Authentication Code",
  description = "Enter your 6-digit authentication code to proceed.",
}: AuthCodeVerifyModalProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    if (open) {
      setCode("");
      setVerifying(false);
      return;
    }

    setVerifying(false);
  }, [open]);

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }
    setVerifying(true);
    let data: any = null;
    let error: any = null;
    try {
      const result = await Promise.race([
        verifyAuthCode(code),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("Authentication code verification timed out.")), AUTH_CODE_VERIFY_TIMEOUT_MS),
        ),
      ]);
      data = result as any;
      error = null;
    } catch (err: any) {
      setVerifying(false);
      toast.error(err?.message || "Authentication code verification failed. Please try again.");
      return;
    }
    setVerifying(false);

    if (error || !data?.valid) {
      // If the error indicates no code is set, redirect to setup
      if (data?.error?.toLowerCase().includes("no auth code") || data?.error?.toLowerCase().includes("not set")) {
        setNeedsSetup(true);
        setCode("");
        return;
      }
      toast.error(data?.error || "Invalid authentication code");
      setCode("");
      return;
    }

    setCode("");
    onVerified();
    onOpenChange(false);
  };

  const handleSetupComplete = () => {
    setNeedsSetup(false);
    // After setup, the verify modal is still open so they can verify
  };

  return (
    <>
      <Dialog
        open={open && !needsSetup}
        onOpenChange={(v) => {
          if (!v) {
            setCode("");
            setVerifying(false);
          }
          onOpenChange(v);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <AuthCodeInput value={code} onChange={setCode} disabled={verifying} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleVerify} disabled={verifying || code.length !== 6}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuthCodeSetupModal
        open={needsSetup}
        onOpenChange={(v) => {
          setNeedsSetup(v);
          if (!v) onOpenChange(false);
        }}
        onComplete={handleSetupComplete}
      />
    </>
  );
}
