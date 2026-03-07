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

    const { contest_id } = await req.json();
    if (!contest_id) {
      return new Response(JSON.stringify({ error: "Missing contest_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: contest, error: contestErr } = await supabaseAdmin
      .from("contests")
      .select("*")
      .eq("id", contest_id)
      .single();

    if (contestErr || !contest) {
      return new Response(JSON.stringify({ error: "Contest not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (contest.client_id !== user.id) {
      return new Response(JSON.stringify({ error: "Only the contest owner can publish winners" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (contest.status === "ended" || contest.status === "completed") {
      return new Response(JSON.stringify({ error: "Contest already completed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: nominees } = await supabaseAdmin
      .from("contest_entries")
      .select("*")
      .eq("contest_id", contest_id)
      .eq("is_nominee", true);

    if (!nominees || nominees.length === 0) {
      return new Response(JSON.stringify({ error: "No nominees selected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate expected winners count (up to 5)
    let expectedCount = 1;
    if (contest.prize_second > 0) expectedCount = 2;
    if (contest.prize_third > 0) expectedCount = 3;
    if (contest.prize_fourth > 0) expectedCount = 4;
    if (contest.prize_fifth > 0) expectedCount = 5;

    if (nominees.length !== expectedCount) {
      return new Response(
        JSON.stringify({ error: `Expected ${expectedCount} nominees, got ${nominees.length}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prizes = [
      contest.prize_first,
      contest.prize_second || 0,
      contest.prize_third || 0,
      contest.prize_fourth || 0,
      contest.prize_fifth || 0,
    ];

    const posLabels = ["1st", "2nd", "3rd", "4th", "5th"];

    // Mark nominees as winners
    for (let i = 0; i < nominees.length; i++) {
      await supabaseAdmin
        .from("contest_entries")
        .update({ is_winner: true, prize_position: i + 1, is_nominee: false })
        .eq("id", nominees[i].id);
    }

    // Update contest status to completed
    await supabaseAdmin
      .from("contests")
      .update({ status: "completed" })
      .eq("id", contest_id);

    // Payout prizes
    for (let i = 0; i < nominees.length; i++) {
      const prizeAmount = prizes[i];
      if (prizeAmount <= 0) continue;

      const winnerId = nominees[i].freelancer_id;

      let { data: winnerWallet } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("user_id", winnerId)
        .maybeSingle();

      if (!winnerWallet) {
        const { data: newWallet } = await supabaseAdmin
          .from("wallets")
          .insert({ user_id: winnerId, balance: 0, escrow_balance: 0, total_earned: 0, total_spent: 0 })
          .select()
          .single();
        winnerWallet = newWallet;
      }

      if (!winnerWallet) continue;

      const newBalance = winnerWallet.balance + prizeAmount;
      const newTotalEarned = winnerWallet.total_earned + prizeAmount;
      await supabaseAdmin
        .from("wallets")
        .update({ balance: newBalance, total_earned: newTotalEarned })
        .eq("user_id", winnerId);

      await supabaseAdmin.from("wallet_transactions").insert({
        user_id: winnerId,
        amount: prizeAmount,
        balance_after: newBalance,
        type: "credit",
        description: `Contest prize (${posLabels[i]} place) — "${contest.title}"`,
        reference: `contest_prize_${contest_id}_${i + 1}`,
      });

      const { data: clientWallet } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("user_id", contest.client_id)
        .maybeSingle();

      if (clientWallet) {
        const newEscrow = Math.max(0, clientWallet.escrow_balance - prizeAmount);
        await supabaseAdmin
          .from("wallets")
          .update({ escrow_balance: newEscrow })
          .eq("user_id", contest.client_id);
      }

      await supabaseAdmin.from("notifications").insert({
        user_id: winnerId,
        type: "contest_winner",
        title: `🏆 You won ${posLabels[i]} place!`,
        message: `Congratulations! You won ₦${prizeAmount.toLocaleString()} in "${contest.title}". The prize has been credited to your wallet.`,
        contract_id: null,
      });
    }

    return new Response(
      JSON.stringify({ success: true, winners: nominees.length }),
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
