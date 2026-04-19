import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/api/axios";
import { toast } from "sonner";

interface AuthCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  locked?: boolean;
  onUnlocked?: () => void;
}

export function AuthCodeInput({ value, onChange, disabled, locked, onUnlocked }: AuthCodeInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "confirm">("request");
  const [resetToken, setResetToken] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newCodeRef] = useState(() => ({ inputs: [] as (HTMLInputElement | null)[] }));
  const [resetLoading, setResetLoading] = useState(false);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d?$/.test(digit)) return;
    const arr = value.split("");
    while (arr.length < 6) arr.push("");
    arr[index] = digit;
    const newVal = arr.join("").slice(0, 6);
    onChange(newVal);
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 5);
    inputs.current[focusIdx]?.focus();
  };

  const handleRequestReset = async () => {
    setResetLoading(true);
    try {
      await api.post("/auth/auth-code", { action: "request_reset" });
      setResetStep("confirm");
      toast.success("Reset code sent to your email");
    } catch {
      toast.error("Failed to send reset email");
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (resetToken.length !== 6 || newCode.length !== 6) {
      toast.error("Enter both the 6-digit reset token and your new code");
      return;
    }
    setResetLoading(true);
    try {
      await api.post("/auth/auth-code", {
        action: "confirm_reset",
        reset_token: resetToken,
        new_code: newCode,
      });
      toast.success("Auth code reset successfully");
      setShowReset(false);
      setResetStep("request");
      setResetToken("");
      setNewCode("");
      onUnlocked?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Reset failed");
    } finally {
      setResetLoading(false);
    }
  };

  if (showReset) {
    return (
      <div className="space-y-4">
        {resetStep === "request" ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              A 6-digit reset code will be sent to your registered email address. It expires in 15 minutes.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleRequestReset} disabled={resetLoading} className="flex-1">
                {resetLoading ? "Sending…" : "Send reset code"}
              </Button>
              <Button variant="outline" onClick={() => setShowReset(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground text-center">Enter the reset code from your email</p>
              <Input
                placeholder="6-digit reset code"
                inputMode="numeric"
                maxLength={6}
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center tracking-widest text-lg"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground text-center">Set your new auth code</p>
              <Input
                placeholder="New 6-digit auth code"
                inputMode="numeric"
                maxLength={6}
                type="password"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center tracking-widest text-lg"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleConfirmReset} disabled={resetLoading || resetToken.length !== 6 || newCode.length !== 6} className="flex-1">
                {resetLoading ? "Resetting…" : "Confirm reset"}
              </Button>
              <Button variant="outline" onClick={() => { setShowReset(false); setResetStep("request"); }}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <Input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={value[i] || ""}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            disabled={disabled || locked}
            className="w-12 h-14 text-center text-xl font-bold"
          />
        ))}
      </div>
      {locked && (
        <p className="text-xs text-destructive text-center">
          Too many failed attempts. Account locked.
        </p>
      )}
      <div className="text-center">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-primary underline"
          onClick={() => { setShowReset(true); setResetStep("request"); }}
        >
          Forgot code? Reset via email
        </button>
      </div>
    </div>
  );
}
