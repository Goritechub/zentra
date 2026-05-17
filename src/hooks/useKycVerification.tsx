import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/api/axios";
import { toast } from "sonner";

export type KycStatus = "not_started" | "pending" | "verified" | "failed" | "manual_review";
export type VerificationLevel = "basic" | "identity_verified" | "zentra_verified";

export interface KycVerification {
  id: string;
  user_id: string;
  didit_session_id: string | null;
  verification_url: string | null;
  kyc_status: KycStatus;
  verification_level: VerificationLevel;
  zentra_verified: boolean;
  created_at: string;
  updated_at: string;
}

export function useKycVerification(userId?: string) {
  const { user, profile, refreshProfile } = useAuth();
  const targetUserId = userId || user?.id;
  const [kycData, setKycData] = useState<KycVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const didAutoCheck = useRef(false);

  // useSearchParams is only valid inside a Router context — wrap in try/catch
  // so the hook stays usable outside Router (e.g. tests, Storybook).
  let searchParams: URLSearchParams | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    [searchParams] = useSearchParams();
  } catch {
    searchParams = null;
  }

  const kycComplete = searchParams?.get("kyc") === "complete";

  const fetchKyc = async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("kyc_verifications" as any)
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();
      setKycData(data as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKyc();
  }, [targetUserId]);

  // Auto-poll when user returns from Didit (?kyc=complete in URL).
  // Only runs once per mount to avoid infinite loops.
  useEffect(() => {
    if (!kycComplete || !user || didAutoCheck.current) return;
    // Only auto-check for the current user's own verification
    if (userId && userId !== user.id) return;

    didAutoCheck.current = true;

    const run = async () => {
      try {
        const res = await api.get("/kyc/status");
        await fetchKyc();

        const status = res?.data?.status;
        if (status === "verified") {
          await refreshProfile();
          toast.success("Identity verified! You can now submit contest entries.");
        } else if (status === "failed") {
          toast.error("Verification was not approved. Please try again or contact support.");
        } else if (status === "manual_review") {
          toast.info("Your verification is under manual review. We'll notify you shortly.");
        }
      } catch {
        // Silent — the user can still manually check status
      }
    };

    void run();
  }, [kycComplete, user]);

  const startVerification = async () => {
    if (!user) return null;
    try {
      const callbackUrl = profile?.role === "client"
        ? `${window.location.origin}/settings?tab=payment&kyc=complete`
        : `${window.location.origin}/expert/${user.id}/profile?kyc=complete`;
      const res = await api.post("/kyc/session", { callback_url: callbackUrl });
      await fetchKyc();
      return res.data;
    } catch (err) {
      console.error("Failed to start KYC:", err);
      throw err;
    }
  };

  const checkStatus = async () => {
    if (!user) return;
    try {
      const res = await api.get("/kyc/status");
      await fetchKyc();

      const status = res?.data?.status;
      if (status === "verified") {
        await refreshProfile();
      }

      return res.data;
    } catch (err) {
      console.error("Failed to check KYC status:", err);
    }
  };

  return {
    kycData,
    loading,
    startVerification,
    checkStatus,
    refetch: fetchKyc,
    isVerified: kycData?.kyc_status === "verified",
    isZentraVerified: kycData?.zentra_verified === true,
    verificationLevel: kycData?.verification_level || "basic",
  };
}
