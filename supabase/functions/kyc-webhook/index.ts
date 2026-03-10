import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyHmacSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook signature from KYC provider
    const webhookSecret = Deno.env.get("DIDIT_WEBHOOK_SECRET");
    const rawBody = await req.text();

    if (webhookSecret) {
      const signature = req.headers.get("x-didit-signature") || req.headers.get("x-webhook-signature") || "";
      const isValid = await verifyHmacSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error("KYC webhook signature verification failed");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("DIDIT_WEBHOOK_SECRET not configured — webhook signature verification skipped");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const payload = JSON.parse(rawBody);
    console.log("KYC webhook payload:", JSON.stringify(payload));

    const sessionId = payload.session_id;
    const status = payload.status; // e.g. "Approved", "Declined", "Need Review"
    const vendorData = payload.vendor_data; // user_id

    if (!sessionId) throw new Error("Missing session_id in webhook");

    // Map Didit statuses to our statuses
    let kycStatus = "pending";
    let verificationLevel = "basic";
    if (status === "Approved") {
      kycStatus = "verified";
      verificationLevel = "identity_verified";
    } else if (status === "Declined") {
      kycStatus = "failed";
    } else if (status === "Need Review") {
      kycStatus = "manual_review";
    }

    // Update verification record
    const updateData: Record<string, unknown> = {
      kyc_status: kycStatus,
      kyc_provider_status: status,
      kyc_provider_result: payload,
      verification_level: verificationLevel,
    };

    // Extract document data if available
    if (payload.document) {
      if (payload.document.full_name) updateData.full_name_on_id = payload.document.full_name;
      if (payload.document.date_of_birth) updateData.date_of_birth = payload.document.date_of_birth;
      if (payload.document.country) updateData.country = payload.document.country;
      if (payload.document.document_type) updateData.document_type = payload.document.document_type;
    }

    // If Didit approved, verify name match and age before auto-approving
    let failReason = "";
    if (kycStatus === "verified" && vendorData) {
      // Fetch profile full_name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", vendorData)
        .single();

      const profileName = (profileData?.full_name || "").toLowerCase().trim();
      const idName = (payload.document?.full_name || "").toLowerCase().trim();

      // Name matching: check that all parts of the profile name appear in the ID name (or vice versa)
      if (profileName && idName) {
        const profileParts = profileName.split(/\s+/).filter((p: string) => p.length > 1);
        const idParts = idName.split(/\s+/).filter((p: string) => p.length > 1);
        const matchCount = profileParts.filter((p: string) => idParts.includes(p)).length;
        
        if (matchCount < Math.min(2, profileParts.length)) {
          kycStatus = "failed";
          verificationLevel = "basic";
          failReason = "Name on ID does not match your profile name. Please ensure your profile name matches your government-issued ID.";
          updateData.kyc_status = kycStatus;
          updateData.verification_level = verificationLevel;
          updateData.admin_notes = `Auto-rejected: Name mismatch. Profile: "${profileData?.full_name}", ID: "${payload.document?.full_name}"`;
        }
      }

      // Age check: must be 18+
      if (kycStatus === "verified" && payload.document?.date_of_birth) {
        const dob = new Date(payload.document.date_of_birth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        if (age < 18) {
          kycStatus = "failed";
          verificationLevel = "basic";
          failReason = "You must be at least 18 years old to use this platform.";
          updateData.kyc_status = kycStatus;
          updateData.verification_level = verificationLevel;
          updateData.admin_notes = `Auto-rejected: Underage (${age} years old). DOB: ${payload.document.date_of_birth}`;
        }
      }
    }

    const { error } = await supabase
      .from("kyc_verifications")
      .update(updateData)
      .eq("didit_session_id", sessionId);

    if (error) {
      console.error("Failed to update KYC record:", error);
      throw new Error(`DB update failed: ${error.message}`);
    }

    // If verified (passed all checks), update profile
    if (kycStatus === "verified" && vendorData) {
      await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", vendorData);

      await supabase.from("notifications").insert({
        user_id: vendorData,
        title: "Identity Verified ✓",
        message: "Your identity has been successfully verified. You can now start contracts on ZentraGig.",
        type: "verification",
      });
    } else if (kycStatus === "failed" && vendorData) {
      await supabase.from("notifications").insert({
        user_id: vendorData,
        title: "Verification Failed",
        message: failReason || "Your identity verification could not be completed. Please try again with valid documents.",
        type: "verification",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("KYC webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
