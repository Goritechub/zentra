import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, ShieldCheck, Copy, CheckCheck } from "lucide-react";
import { getTotpStatus, setupTotp, confirmTotp, disableTotp } from "@/api/auth.api";

type Step = "idle" | "scan" | "confirm" | "enabled";

export function TotpSetupCard() {
  const [step, setStep] = useState<Step>("idle");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);

  useEffect(() => {
    getTotpStatus()
      .then((s) => setStep(s.totp_enabled ? "enabled" : "idle"))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleEnable = async () => {
    setWorking(true);
    try {
      const data = await setupTotp();
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
      setStep("scan");
    } catch {
      toast.error("Failed to start TOTP setup");
    } finally {
      setWorking(false);
    }
  };

  const handleConfirm = async () => {
    if (code.length !== 6) { toast.error("Enter the 6-digit code from your app"); return; }
    setWorking(true);
    try {
      const data = await confirmTotp(code);
      setRecoveryCodes(data.recoveryCodes);
      setCode("");
      setStep("enabled");
      setShowRecovery(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code — check your Authenticator app");
    } finally {
      setWorking(false);
    }
  };

  const handleDisable = async () => {
    if (!disableCode.trim()) { toast.error("Enter your current authenticator code"); return; }
    setWorking(true);
    try {
      await disableTotp(disableCode.trim());
      setDisableCode("");
      setShowDisableDialog(false);
      setStep("idle");
      toast.success("Google Authenticator disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setWorking(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const copyAllRecovery = () => {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setRecoveryCopied(true);
    setTimeout(() => setRecoveryCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Google Authenticator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Loader2 className="h-4 w-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Google Authenticator
          </CardTitle>
          <CardDescription>
            {step === "enabled"
              ? "Two-factor authentication is active. A time-based code from your phone is required to access the admin panel."
              : "Add an extra layer of security. When enabled, you'll need a 6-digit code from Google Authenticator in addition to your PIN."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === "idle" && (
            <Button onClick={handleEnable} disabled={working}>
              {working && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enable Google Authenticator
            </Button>
          )}

          {step === "scan" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong>Step 1:</strong> Open Google Authenticator on your phone and scan this QR code.
              </p>
              {qrDataUrl && (
                <img src={qrDataUrl} alt="TOTP QR Code" className="w-48 h-48 border rounded-lg" />
              )}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Can't scan? Enter this code manually:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded select-all break-all flex-1">
                    {secret}
                  </code>
                  <Button variant="ghost" size="icon" onClick={copySecret} className="shrink-0">
                    {secretCopied ? <CheckCheck className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button onClick={() => setStep("confirm")}>
                I've scanned it — Continue
              </Button>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong>Step 2:</strong> Enter the 6-digit code shown in your Authenticator app to confirm setup.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  inputMode="numeric"
                  className="w-36 text-center tracking-widest text-lg"
                  onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                />
                <Button onClick={handleConfirm} disabled={working || code.length !== 6}>
                  {working && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Confirm
                </Button>
                <Button variant="outline" onClick={() => setStep("scan")}>Back</Button>
              </div>
            </div>
          )}

          {step === "enabled" && (
            <div className="flex items-center justify-between">
              <Badge className="bg-success/10 text-success">
                Active
              </Badge>
              <Button variant="destructive" size="sm" onClick={() => setShowDisableDialog(true)}>
                Disable
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recovery codes dialog — shown once after confirming TOTP */}
      <Dialog open={showRecovery} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Save your recovery codes</DialogTitle>
            <DialogDescription>
              These 8 codes can be used to access your account if you lose your phone.
              Each code can only be used once. <strong>They will not be shown again.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 my-2">
            {recoveryCodes.map((rc) => (
              <code key={rc} className="text-sm font-mono bg-muted px-3 py-1.5 rounded text-center">
                {rc}
              </code>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={copyAllRecovery} className="w-full sm:w-auto">
              {recoveryCopied ? <CheckCheck className="h-4 w-4 mr-2 text-success" /> : <Copy className="h-4 w-4 mr-2" />}
              Copy All
            </Button>
            <Button onClick={() => setShowRecovery(false)} className="w-full sm:w-auto">
              I've saved them — Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable confirmation dialog */}
      <Dialog open={showDisableDialog} onOpenChange={(v) => { setShowDisableDialog(v); if (!v) setDisableCode(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Disable Google Authenticator</DialogTitle>
            <DialogDescription>
              Enter your current 6-digit code (or a recovery code) to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="000000 or XXXX-XXXX"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDisable()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDisable} disabled={working}>
              {working && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Disable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
