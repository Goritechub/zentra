import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function autoGrantZentraBadge(supabase: any, userId: string): Promise<void> {
  const [kycRes, profileRes] = await Promise.all([
    supabase.from("kyc_verifications").select("id, zentra_verified").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
  ]);
  const kyc = kycRes.data;
  if (!kyc || kyc.zentra_verified) return;
  const role = profileRes.data?.role;
  const badgeLabel = role === "client" ? "ZentraGig Verified Partner" : "ZentraGig Verified Engineer";
  await supabase.from("kyc_verifications").update({
    zentra_verified: true,
    verification_level: "zentra_verified",
    zentra_verified_at: new Date().toISOString(),
  }).eq("id", kyc.id);
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "verification",
    title: `⭐ ${badgeLabel}`,
    message: `Congratulations! You've earned the ${badgeLabel} badge for completing a contest transaction on ZentraGig.`,
  });
}

async function autoGrantZentraBadgesBatch(supabase: any, contestId: string): Promise<void> {
  const [contestRes, winnersRes] = await Promise.all([
    supabase.from("contests").select("client_id").eq("id", contestId).maybeSingle(),
    supabase.from("contest_entries").select("freelancer_id").eq("contest_id", contestId).eq("is_winner", true),
  ]);
  const userIds = new Set<string>();
  if (contestRes.data?.client_id) userIds.add(contestRes.data.client_id);
  for (const entry of (winnersRes.data ?? [])) userIds.add(entry.freelancer_id);
  await Promise.all([...userIds].map((uid) => autoGrantZentraBadge(supabase, uid)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contest_id } = await req.json();
    if (!contest_id) {
      return new Response(JSON.stringify({ error: "Missing contest_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use atomic RPC for the entire winner publishing + payout
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("publish_contest_winners_atomic", {
      _user_id: user.id,
      _contest_id: contest_id,
    });

    if (rpcError) {
      console.error("publish_contest_winners_atomic error:", rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message || "Internal error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result?.success) {
      return new Response(
        JSON.stringify({ error: result?.error || "Publishing failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-grant ZentraBadge to contest winners and the client
    autoGrantZentraBadgesBatch(supabaseAdmin, contest_id).catch(() => {});

    return new Response(
      JSON.stringify({ success: true, winners: result.winners }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Publish contest winners error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
