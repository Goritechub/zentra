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
    const diditWorkflowId = Deno.env.get("DIDIT_WORKFLOW_ID");

    if (!diditApiKey) throw new Error("DIDIT_API_KEY not configured");
    if (!diditWorkflowId) throw new Error("DIDIT_WORKFLOW_ID not configured");

    // Auth user
    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { callback_url } = await req.json();

    // Create Didit session
    const diditResponse = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": diditApiKey,
      },
      body: JSON.stringify({
        workflow_id: diditWorkflowId,
        vendor_data: user.id,
        callback: callback_url || undefined,
      }),
    });

    if (!diditResponse.ok) {
      const errorBody = await diditResponse.text();
      throw new Error(`Didit API error [${diditResponse.status}]: ${errorBody}`);
    }

    const diditData = await diditResponse.json();

    // Store session in DB using service role
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { error: upsertError } = await supabaseAdmin
      .from("kyc_verifications")
      .upsert(
        {
          user_id: user.id,
          didit_session_id: diditData.session_id,
          verification_url: diditData.verification_url || diditData.url,
          kyc_status: "pending",
          kyc_provider_status: "initiated",
        },
        { onConflict: "user_id" }
      );

    if (upsertError) throw new Error(`DB error: ${upsertError.message}`);

    return new Response(
      JSON.stringify({
        session_id: diditData.session_id,
        verification_url: diditData.verification_url || diditData.url,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("KYC create session error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
