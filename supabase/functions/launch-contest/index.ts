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

    const p1 = prize_first || 0;
    const p2 = prize_second || 0;
    const p3 = prize_third || 0;
    const p4 = prize_fourth || 0;
    const p5 = prize_fifth || 0;
    const totalPrizePool = p1 + p2 + p3 + p4 + p5;

    if (totalPrizePool <= 0) {
      return new Response(JSON.stringify({ error: "Prize pool must be greater than zero" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check wallet balance
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const availableBalance = wallet?.balance || 0;

    if (availableBalance < totalPrizePool) {
      return new Response(JSON.stringify({
        error: "insufficient_funds",
        wallet_balance: availableBalance,
        total_prize_pool: totalPrizePool,
        shortfall: totalPrizePool - availableBalance,
      }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create contest as active
    const { data: contest, error: contestErr } = await supabaseAdmin
      .from("contests")
      .insert({
        client_id: user.id,
        title: title.trim(),
        description: description.trim(),
        category: category || null,
        prize_first: p1,
        prize_second: p2,
        prize_third: p3,
        prize_fourth: p4,
        prize_fifth: p5,
        deadline,
        required_skills: required_skills || [],
        visibility: visibility || "open",
        rules: rules || null,
        banner_image: banner_image || null,
        winner_selection_method: winner_selection_method || "client_selects",
        status: "active",
      })
      .select()
      .single();

    if (contestErr || !contest) {
      console.error("Contest creation error:", contestErr);
      return new Response(JSON.stringify({ error: "Failed to create contest" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct from wallet balance, add to escrow
    const newBalance = availableBalance - totalPrizePool;
    const newEscrow = (wallet?.escrow_balance || 0) + totalPrizePool;
    const newTotalSpent = (wallet?.total_spent || 0) + totalPrizePool;

    const { error: walletErr } = await supabaseAdmin
      .from("wallets")
      .update({ balance: newBalance, escrow_balance: newEscrow, total_spent: newTotalSpent })
      .eq("user_id", user.id);

    if (walletErr) {
      // Rollback: delete the contest
      await supabaseAdmin.from("contests").delete().eq("id", contest.id);
      console.error("Wallet update error:", walletErr);
      return new Response(JSON.stringify({ error: "Failed to fund escrow. Contest not created." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create wallet transaction record (debit)
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: user.id,
      amount: totalPrizePool,
      balance_after: newBalance,
      type: "debit",
      description: `Contest prize pool escrow — "${title.trim()}"`,
      reference: `contest_escrow_${contest.id}`,
    });

    return new Response(JSON.stringify({ success: true, contest_id: contest.id }), {
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
