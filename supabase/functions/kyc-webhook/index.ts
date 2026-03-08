import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const payload = await req.json();
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

    const { error } = await supabase
      .from("kyc_verifications")
      .update(updateData)
      .eq("didit_session_id", sessionId);

    if (error) {
      console.error("Failed to update KYC record:", error);
      throw new Error(`DB update failed: ${error.message}`);
    }

    // If verified, also update profiles.is_verified
    if (kycStatus === "verified" && vendorData) {
      await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", vendorData);

      // Send notification
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
        message: "Your identity verification could not be completed. Please try again with valid documents.",
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
