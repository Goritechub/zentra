import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const { user } = useAuth();
  const targetUserId = userId || user?.id;
  const [kycData, setKycData] = useState<KycVerification | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchKyc = async () => {
    if (!targetUserId) { setLoading(false); return; }
    const { data } = await supabase
      .from("kyc_verifications" as any)
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();
    setKycData(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchKyc();
  }, [targetUserId]);

  const startVerification = async () => {
    if (!user) return null;
    try {
      const callbackUrl = `${window.location.origin}/expert/${user.id}/profile?kyc=complete`;
      const { data, error } = await supabase.functions.invoke("kyc-create-session", {
        body: { callback_url: callbackUrl },
      });
      if (error) throw error;
      await fetchKyc();
      return data;
    } catch (err) {
      console.error("Failed to start KYC:", err);
      throw err;
    }
  };

  const checkStatus = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("kyc-check-status");
      if (error) throw error;
      await fetchKyc();
      return data;
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
