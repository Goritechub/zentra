import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthCodeInput } from "@/components/AuthCodeInput";
import { Progress } from "@/components/ui/progress";
import { Loader2, ShieldCheck, Check, X } from "lucide-react";

function getCodeStrength(code: string) {
  if (code.length < 6) return { score: 0, label: "", color: "" };
  
  let score = 0;
  const checks = {
    length: code.length === 6 && /^\d{6}$/.test(code),
    notAllSame: !/^(\d)\1{5}$/.test(code),
    notSequential: !"0123456789".includes(code) && !"9876543210".includes(code),
    notRepeatingPair: !/^(\d{2})\1{2}$/.test(code),
    notRepeatingTriplet: !/^(\d{3})\1$/.test(code),
    hasVariety: new Set(code.split("")).size >= 3,
  };

  if (checks.length) score++;
  if (checks.notAllSame) score++;
  if (checks.notSequential) score++;
  if (checks.notRepeatingPair) score++;
  if (checks.notRepeatingTriplet) score++;
  if (checks.hasVariety) score++;

  const labels = ["", "Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const colors = ["", "bg-destructive", "bg-destructive", "bg-amber-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-500"];

  return { score, label: labels[score] || "", color: colors[score] || "", checks };
}

export function ChangeAuthCodeCard() {
  const [step, setStep] = useState<"idle" | "changing">("idle");
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [saving, setSaving] = useState(false);

  const strength = getCodeStrength(newCode);
  const codesMatch = newCode.length === 6 && confirmCode.length === 6 && newCode === confirmCode;
  const isStrong = strength.score >= 4;

  const handleChange = async () => {
    if (currentCode.length !== 6) {
      toast.error("Enter your current 6-digit code");
      return;
    }
    if (newCode.length !== 6 || !/^\d{6}$/.test(newCode)) {
      toast.error("Enter a valid new 6-digit code");
      return;
    }
    if (!isStrong) {
      toast.error("New code is too weak. Avoid patterns and repeated digits.");
      return;
    }
    if (newCode !== confirmCode) {
      toast.error("New codes don't match");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.functions.invoke("auth-code", {
      body: { action: "change", current_code: currentCode, new_code: newCode },
    });
    setSaving(false);

    if (error || !data?.success) {
      toast.error(data?.error || "Failed to change code");
      return;
    }

    toast.success("Authentication code changed successfully!");
    setStep("idle");
    setCurrentCode("");
    setNewCode("");
    setConfirmCode("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Authentication Code
        </CardTitle>
        <CardDescription>
          Change your 6-digit transaction authentication code used for withdrawals and sensitive actions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "idle" ? (
          <Button variant="outline" onClick={() => setStep("changing")}>
            Change Authentication Code
          </Button>
        ) : (
          <div className="space-y-5">
            {/* Current code */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Code</label>
              <AuthCodeInput value={currentCode} onChange={setCurrentCode} disabled={saving} />
            </div>

            {/* New code */}
            <div className="space-y-2">
              <label className="text-sm font-medium">New Code</label>
              <AuthCodeInput value={newCode} onChange={setNewCode} disabled={saving} />
              {newCode.length === 6 && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Progress value={(strength.score / 6) * 100} className="flex-1 h-2" />
                    <span className={`text-xs font-medium ${strength.score >= 4 ? "text-emerald-500" : strength.score >= 3 ? "text-amber-500" : "text-destructive"}`}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <StrengthCheck pass={strength.checks?.notAllSame} label="Not all same digits" />
                    <StrengthCheck pass={strength.checks?.notSequential} label="Not sequential" />
                    <StrengthCheck pass={strength.checks?.notRepeatingPair} label="No repeating pairs" />
                    <StrengthCheck pass={strength.checks?.hasVariety} label="3+ unique digits" />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm new code */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Code</label>
              <AuthCodeInput value={confirmCode} onChange={setConfirmCode} disabled={saving} />
              {confirmCode.length === 6 && !codesMatch && (
                <p className="text-xs text-destructive mt-1">Codes don't match</p>
              )}
              {codesMatch && (
                <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Codes match
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("idle");
                  setCurrentCode("");
                  setNewCode("");
                  setConfirmCode("");
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleChange}
                disabled={saving || !codesMatch || !isStrong || currentCode.length !== 6}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Update Code
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StrengthCheck({ pass, label }: { pass?: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1 ${pass ? "text-emerald-500" : "text-muted-foreground"}`}>
      {pass ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      <span>{label}</span>
    </div>
  );
}
