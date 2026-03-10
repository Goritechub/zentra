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

    const body = await req.json();
    const {
      title, description, category, prize_first, prize_second, prize_third,
      prize_fourth, prize_fifth, deadline, required_skills, visibility,
      rules, banner_image, winner_selection_method,
    } = body;

    if (!title || !description || !prize_first || !deadline) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use atomic RPC for contest creation + escrow lock
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("launch_contest_atomic", {
      _user_id: user.id,
      _title: title.trim(),
      _description: description.trim(),
      _category: category || null,
      _prize_first: prize_first || 0,
      _prize_second: prize_second || 0,
      _prize_third: prize_third || 0,
      _prize_fourth: prize_fourth || 0,
      _prize_fifth: prize_fifth || 0,
      _deadline: deadline,
      _required_skills: required_skills || [],
      _visibility: visibility || "open",
      _rules: rules || null,
      _banner_image: banner_image || null,
      _winner_selection_method: winner_selection_method || "client_selects",
    });

    if (rpcError) {
      console.error("launch_contest_atomic error:", rpcError);
      return new Response(JSON.stringify({ error: rpcError.message || "Failed to create contest" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!result?.success) {
      // Check for insufficient_funds error
      const status = result?.error === "insufficient_funds" ? 402 : 400;
      return new Response(JSON.stringify({
        error: result?.error || "Failed to create contest",
        wallet_balance: result?.wallet_balance,
        total_prize_pool: result?.total_prize_pool,
        shortfall: result?.shortfall,
      }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, contest_id: result.contest_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Launch contest error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
