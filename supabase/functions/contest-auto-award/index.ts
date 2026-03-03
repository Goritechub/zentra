import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find contests in "selecting_winners" or "active" status past deadline
    const { data: contests } = await supabase
      .from("contests")
      .select("*")
      .in("status", ["selecting_winners", "active"])
      .lt("deadline", new Date().toISOString());

    if (!contests || contests.length === 0) {
      return new Response(JSON.stringify({ message: "No contests to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const contest of contests) {
      const daysSinceDeadline = Math.floor(
        (Date.now() - new Date(contest.deadline).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Auto-update active contests past deadline to selecting_winners
      if (contest.status === "active") {
        await supabase
          .from("contests")
          .update({ status: "selecting_winners" })
          .eq("id", contest.id);

        // Notify client
        await supabase.from("notifications").insert({
          user_id: contest.client_id,
          type: "contest_deadline",
          title: "Contest deadline reached",
          message: `Your contest "${contest.title}" has ended. Please select winners.`,
          contract_id: null,
        });
        
        results.push({ contest_id: contest.id, action: "status_updated_to_selecting" });
        continue;
      }

      // Send reminder at 22 days (3 days before 25-day limit)
      if (daysSinceDeadline === 22) {
        await supabase.from("notifications").insert({
          user_id: contest.client_id,
          type: "contest_reminder",
          title: "Select winners soon",
          message: `You have 3 days left to select winners for "${contest.title}" before auto-award.`,
          contract_id: null,
        });
        results.push({ contest_id: contest.id, action: "reminder_3_days" });
      }

      // Send reminder at 24 days (1 day before 25-day limit)
      if (daysSinceDeadline === 24) {
        await supabase.from("notifications").insert({
          user_id: contest.client_id,
          type: "contest_reminder",
          title: "Final reminder — select winners",
          message: `Tomorrow is the last day to select winners for "${contest.title}". After that, nominees will be auto-awarded.`,
          contract_id: null,
        });
        results.push({ contest_id: contest.id, action: "reminder_1_day" });
      }

      // Auto-award at 25 days
      if (daysSinceDeadline >= 25) {
        // Get nominees
        const { data: nominees } = await supabase
          .from("contest_entries")
          .select("*")
          .eq("contest_id", contest.id)
          .eq("is_nominee", true);

        if (nominees && nominees.length > 0) {
          // Auto-publish nominees as winners
          for (let i = 0; i < Math.min(nominees.length, 3); i++) {
            await supabase
              .from("contest_entries")
              .update({
                is_winner: true,
                prize_position: i + 1,
                is_nominee: false,
              })
              .eq("id", nominees[i].id);
          }

          await supabase
            .from("contests")
            .update({ status: "ended" })
            .eq("id", contest.id);

          await supabase.from("notifications").insert({
            user_id: contest.client_id,
            type: "contest_auto_award",
            title: "Winners auto-awarded",
            message: `Winners for "${contest.title}" have been automatically awarded based on your nominees.`,
            contract_id: null,
          });

          results.push({ contest_id: contest.id, action: "auto_awarded" });
        } else {
          // No nominees - flag for admin review
          await supabase.from("notifications").insert({
            user_id: contest.client_id,
            type: "contest_no_nominees",
            title: "Action required — No nominees selected",
            message: `Your contest "${contest.title}" has no nominees after 25 days. Please select nominees or contact support.`,
            contract_id: null,
          });

          results.push({ contest_id: contest.id, action: "no_nominees_flagged" });
        }
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
