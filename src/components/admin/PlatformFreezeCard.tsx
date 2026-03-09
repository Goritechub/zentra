import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldAlert } from "lucide-react";
import { AuthCodeVerifyModal } from "@/components/AuthCodeVerifyModal";
import { broadcastNotification } from "@/lib/broadcast";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformFreeze } from "@/hooks/usePlatformFreeze";

export function PlatformFreezeCard() {
  const { user } = useAuth();
  const { signupsPaused, platformFrozen, freezeMessage, refetch } = usePlatformFreeze();

  const [localSignupsPaused, setLocalSignupsPaused] = useState(signupsPaused);
  const [localPlatformFrozen, setLocalPlatformFrozen] = useState(platformFrozen);
  const [localFreezeMessage, setLocalFreezeMessage] = useState(freezeMessage);
  const [saving, setSaving] = useState(false);

  // Pending action awaiting auth code verification
  const [pendingAction, setPendingAction] = useState<null | "toggle_signups" | "toggle_freeze">(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    setLocalSignupsPaused(signupsPaused);
    setLocalPlatformFrozen(platformFrozen);
    setLocalFreezeMessage(freezeMessage);
  }, [signupsPaused, platformFrozen, freezeMessage]);

  const requestToggle = (action: "toggle_signups" | "toggle_freeze") => {
    setPendingAction(action);
    setAuthModalOpen(true);
  };

  const handleVerified = async () => {
    if (!pendingAction) return;
    setSaving(true);

    try {
      if (pendingAction === "toggle_signups") {
        const newVal = !localSignupsPaused;
        await upsertSetting("signups_paused", { enabled: newVal });
        setLocalSignupsPaused(newVal);
        toast.success(newVal ? "New signups paused" : "Signups resumed");

        if (newVal) {
          await broadcastNotification({
            title: "Platform Update",
            message: "New user registrations have been temporarily paused by the administrator.",
            type: "policy_update",
          }).catch(() => {});
        }
      }

      if (pendingAction === "toggle_freeze") {
        const newVal = !localPlatformFrozen;
        const msg = localFreezeMessage || "The platform is temporarily under maintenance.";
        await upsertSetting("platform_frozen", { enabled: newVal, message: msg });
        setLocalPlatformFrozen(newVal);
        toast.success(newVal ? "Platform frozen" : "Platform unfrozen");

        await broadcastNotification({
          title: newVal ? "⚠️ Platform Maintenance" : "✅ Platform Restored",
          message: newVal ? msg : "The platform has been restored to normal operations.",
          type: "security_alert",
        }).catch(() => {});
      }

      await refetch();
    } catch (e) {
      toast.error("Failed to update setting");
      console.error(e);
    }

    setSaving(false);
    setPendingAction(null);
  };

  const upsertSetting = async (key: string, value: any) => {
    // Try update first, then insert
    const { data: existing } = await supabase
      .from("platform_settings")
      .select("id")
      .eq("key", key)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("platform_settings")
        .update({ value, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq("key", key);
    } else {
      await supabase
        .from("platform_settings")
        .insert({ key, value, updated_by: user?.id });
    }
  };

  const updateFreezeMessage = async () => {
    if (!localFreezeMessage.trim()) return;
    setSaving(true);
    await upsertSetting("platform_frozen", { enabled: localPlatformFrozen, message: localFreezeMessage });
    toast.success("Freeze message updated");
    await refetch();
    setSaving(false);
  };

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Emergency Controls
          </CardTitle>
          <CardDescription>
            Freeze platform operations. Requires your authentication code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pause Signups */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50 border border-border">
            <div>
              <Label className="font-semibold">Pause New Signups</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Block new user registrations. Existing users can still sign in.
              </p>
            </div>
            <Switch
              checked={localSignupsPaused}
              onCheckedChange={() => requestToggle("toggle_signups")}
              disabled={saving}
            />
          </div>

          {/* Freeze Platform */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50 border border-border">
            <div>
              <Label className="font-semibold">Freeze All Services</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Put the entire platform on hold. Users will see a maintenance banner and cannot post jobs, submit proposals, or create contracts.
              </p>
            </div>
            <Switch
              checked={localPlatformFrozen}
              onCheckedChange={() => requestToggle("toggle_freeze")}
              disabled={saving}
            />
          </div>

          {/* Freeze message */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Freeze Message</Label>
            <div className="flex gap-2">
              <Input
                value={localFreezeMessage}
                onChange={(e) => setLocalFreezeMessage(e.target.value)}
                placeholder="The platform is temporarily under maintenance."
                className="flex-1"
              />
              <button
                onClick={updateFreezeMessage}
                disabled={saving}
                className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Shown to users when the platform is frozen.</p>
          </div>
        </CardContent>
      </Card>

      <AuthCodeVerifyModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onVerified={handleVerified}
        title="Confirm Emergency Action"
        description="Enter your 6-digit authentication code to confirm this critical platform change."
      />
    </>
  );
}
