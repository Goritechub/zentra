import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCodeInput } from "@/components/AuthCodeInput";
import { AuthCodeSetupModal } from "@/components/AuthCodeSetupModal";
import { verifyAuthCode, getTotpStatus } from "@/api/auth.api";
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
  description,
}: AuthCodeVerifyModalProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  useEffect(() => {
    if (!open) {
      setVerifying(false);
      setUseRecovery(false);
      setRecoveryCode("");
      setCode("");
      return;
    }
    setCode("");
    setVerifying(false);
    setUseRecovery(false);
    setRecoveryCode("");
    getTotpStatus().then((s) => setTotpEnabled(s.totp_enabled)).catch(() => {});
  }, [open]);

  const resolvedDescription = description ?? (
    totpEnabled
      ? "Enter the 6-digit code from your Google Authenticator app."
      : "Enter your 6-digit authentication code to proceed."
  );

  const handleVerify = async () => {
    const submittedCode = useRecovery ? recoveryCode.trim() : code;
    if (!useRecovery && submittedCode.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }
    if (useRecovery && !submittedCode) {
      toast.error("Please enter your recovery code");
      return;
    }

    setVerifying(true);
    let data: { valid: boolean; error: string | null } | null = null;
    try {
      data = await Promise.race([
        verifyAuthCode(submittedCode),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("Authentication code verification timed out.")),
            AUTH_CODE_VERIFY_TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (err) {
      setVerifying(false);
      toast.error(err instanceof Error ? err.message : "Authentication code verification failed. Please try again.");
      return;
    }
    setVerifying(false);

    if (!data?.valid) {
      if (data?.error?.toLowerCase().includes("no auth code") || data?.error?.toLowerCase().includes("not set")) {
        setNeedsSetup(true);
        setCode("");
        return;
      }
      toast.error(data?.error || "Invalid authentication code");
      setCode("");
      setRecoveryCode("");
      return;
    }

    setCode("");
    setRecoveryCode("");
    onVerified();
    onOpenChange(false);
  };

  const handleSetupComplete = () => {
    setNeedsSetup(false);
  };

  return (
    <>
      <Dialog
        open={open && !needsSetup}
        onOpenChange={(v) => {
          if (!v) {
            setCode("");
            setVerifying(false);
            setUseRecovery(false);
            setRecoveryCode("");
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
            <DialogDescription>{resolvedDescription}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {useRecovery ? (
              <Input
                placeholder="XXXX-XXXX"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase().slice(0, 9))}
                disabled={verifying}
                className="text-center tracking-widest font-mono"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              />
            ) : (
              <AuthCodeInput value={code} onChange={setCode} disabled={verifying} />
            )}
            {totpEnabled && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                onClick={() => {
                  setUseRecovery((v) => !v);
                  setCode("");
                  setRecoveryCode("");
                }}
              >
                {useRecovery ? "Use Authenticator app instead" : "Use a recovery code"}
              </button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={handleVerify}
              disabled={verifying || (!useRecovery && code.length !== 6) || (useRecovery && !recoveryCode.trim())}
            >
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
