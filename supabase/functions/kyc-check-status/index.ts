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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const diditApiKey = Deno.env.get("DIDIT_API_KEY");

    if (!diditApiKey) throw new Error("DIDIT_API_KEY not configured");

    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Get the user's KYC record
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: kycRecord } = await supabaseAdmin
      .from("kyc_verifications")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!kycRecord || !kycRecord.didit_session_id) {
      return new Response(
        JSON.stringify({ status: "not_started" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already resolved, return from DB
    if (["verified", "failed"].includes(kycRecord.kyc_status)) {
      return new Response(
        JSON.stringify({
          status: kycRecord.kyc_status,
          verification_level: kycRecord.verification_level,
          zentra_verified: kycRecord.zentra_verified,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Poll Didit for status
    const diditResponse = await fetch(
      `https://verification.didit.me/v3/session/${kycRecord.didit_session_id}/decision/`,
      {
        headers: { "x-api-key": diditApiKey },
      }
    );

    if (!diditResponse.ok) {
      return new Response(
        JSON.stringify({
          status: kycRecord.kyc_status,
          verification_level: kycRecord.verification_level,
          zentra_verified: kycRecord.zentra_verified,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const decision = await diditResponse.json();
    let newStatus = kycRecord.kyc_status;
    let newLevel = kycRecord.verification_level;

    if (decision.status === "Approved") {
      newStatus = "verified";
      newLevel = "identity_verified";
    } else if (decision.status === "Declined") {
      newStatus = "failed";
    } else if (decision.status === "Need Review") {
      newStatus = "manual_review";
    }

    if (newStatus !== kycRecord.kyc_status) {
      const updateData: Record<string, unknown> = {
        kyc_status: newStatus,
        kyc_provider_status: decision.status,
        kyc_provider_result: decision,
        verification_level: newLevel,
      };

      await supabaseAdmin
        .from("kyc_verifications")
        .update(updateData)
        .eq("id", kycRecord.id);

      if (newStatus === "verified") {
        await supabaseAdmin
          .from("profiles")
          .update({ is_verified: true })
          .eq("id", user.id);
      }
    }

    return new Response(
      JSON.stringify({
        status: newStatus,
        verification_level: newLevel,
        zentra_verified: kycRecord.zentra_verified,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("KYC check status error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
