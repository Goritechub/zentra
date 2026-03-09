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

      // Extract document data if available
      if (decision.document) {
        if (decision.document.full_name) updateData.full_name_on_id = decision.document.full_name;
        if (decision.document.date_of_birth) updateData.date_of_birth = decision.document.date_of_birth;
        if (decision.document.country) updateData.country = decision.document.country;
        if (decision.document.document_type) updateData.document_type = decision.document.document_type;
      }

      // If approved by Didit, validate name match and age
      if (newStatus === "verified") {
        const { data: profileData } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        const profileName = (profileData?.full_name || "").toLowerCase().trim();
        const idName = (decision.document?.full_name || "").toLowerCase().trim();

        if (profileName && idName) {
          const profileParts = profileName.split(/\s+/).filter((p: string) => p.length > 1);
          const idParts = idName.split(/\s+/).filter((p: string) => p.length > 1);
          const matchCount = profileParts.filter((p: string) => idParts.includes(p)).length;

          if (matchCount < Math.min(2, profileParts.length)) {
            newStatus = "failed";
            newLevel = "basic";
            updateData.kyc_status = newStatus;
            updateData.verification_level = newLevel;
            updateData.admin_notes = `Auto-rejected: Name mismatch. Profile: "${profileData?.full_name}", ID: "${decision.document?.full_name}"`;
          }
        }

        if (newStatus === "verified" && decision.document?.date_of_birth) {
          const dob = new Date(decision.document.date_of_birth);
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const monthDiff = today.getMonth() - dob.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
          }
          if (age < 18) {
            newStatus = "failed";
            newLevel = "basic";
            updateData.kyc_status = newStatus;
            updateData.verification_level = newLevel;
            updateData.admin_notes = `Auto-rejected: Underage (${age} years old)`;
          }
        }
      }

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
