import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook that gates sensitive actions behind auth code setup + verification.
 * 
 * Usage:
 *   const { requireAuthCode, SetupModal, VerifyModal } = useRequireAuthCode();
 *   
 *   // Before a sensitive action:
 *   requireAuthCode(() => { /* do sensitive thing * / });
 *   
 *   // Render both modals in your JSX:
 *   {SetupModal}
 *   {VerifyModal}
 */

import { AuthCodeVerifyModal } from "@/components/AuthCodeVerifyModal";
import { AuthCodeSetupModal } from "@/components/AuthCodeSetupModal";

export function useRequireAuthCode() {
  const { user } = useAuth();
  const [showSetup, setShowSetup] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const [checking, setChecking] = useState(false);

  const requireAuthCode = useCallback(async (onVerified: () => void) => {
    if (!user) return;
    pendingAction.current = onVerified;
    setChecking(true);

    try {
      const { data } = await supabase.functions.invoke("auth-code", {
        body: { action: "check" },
      });

      if (data?.has_code) {
        // User has code, ask them to verify
        setShowVerify(true);
      } else {
        // User hasn't set up code yet — force setup
        setShowSetup(true);
      }
    } catch {
      // On error, try verify flow as fallback
      setShowVerify(true);
    } finally {
      setChecking(false);
    }
  }, [user]);

  const handleSetupComplete = () => {
    setShowSetup(false);
    // After setting up, immediately ask to verify
    setShowVerify(true);
  };

  const handleVerified = () => {
    setShowVerify(false);
    pendingAction.current?.();
    pendingAction.current = null;
  };

  const SetupModal = (
    <AuthCodeSetupModal
      open={showSetup}
      onOpenChange={setShowSetup}
      onComplete={handleSetupComplete}
    />
  );

  const VerifyModal = (
    <AuthCodeVerifyModal
      open={showVerify}
      onOpenChange={(v) => {
        setShowVerify(v);
        if (!v) pendingAction.current = null;
      }}
      onVerified={handleVerified}
    />
  );

  return { requireAuthCode, checking, SetupModal, VerifyModal };
}
