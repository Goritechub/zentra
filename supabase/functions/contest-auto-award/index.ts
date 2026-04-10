import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Escalating notification schedule (days past deadline → message)
// Winners are NEVER auto-published — only the host can do that.
const REMINDER_SCHEDULE: { day: number; title: string; message: (title: string) => string }[] = [
  {
    day: 1,
    title: "Contest deadline reached — select your winners",
    message: (t) => `Your contest "${t}" has ended. Review the entries and select your nominees to publish winners.`,
  },
  {
    day: 3,
    title: "Reminder: Winners not yet published",
    message: (t) => `It's been 3 days since your contest "${t}" ended. Please select your nominees and publish the winners.`,
  },
  {
    day: 7,
    title: "Action required: Select contest winners",
    message: (t) => `Your contest "${t}" ended 7 days ago and winners have not been published. Participants are waiting — please select your nominees now.`,
  },
  {
    day: 14,
    title: "Urgent: Contest winners overdue",
    message: (t) => `It has been 2 weeks since your contest "${t}" ended. Please publish the winners as soon as possible. Continued delays may affect your standing on the platform.`,
  },
  {
    day: 21,
    title: "Final notice: Publish contest winners",
    message: (t) => `3 weeks have passed since your contest "${t}" ended without published winners. This is your final notice — please select nominees and publish winners immediately or contact support.`,
  },
];

// After day 21, send a weekly escalation indefinitely
const WEEKLY_ESCALATION_TITLE = "Overdue: Contest winners still unpublished";
const weeklyEscalationMessage = (title: string, days: number) =>
  `Your contest "${title}" ended ${days} days ago and winners remain unpublished. Please act immediately or contact Zentra support.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

      // Transition active → selecting_winners at deadline
      if (contest.status === "active") {
        await supabase
          .from("contests")
          .update({ status: "selecting_winners" })
          .eq("id", contest.id);

        results.push({ contest_id: contest.id, action: "status_updated_to_selecting" });
        // Fall through so the day-1 notification fires in the same run
      }

      // Check fixed reminder schedule
      const scheduledReminder = REMINDER_SCHEDULE.find((r) => r.day === daysSinceDeadline);
      if (scheduledReminder) {
        await supabase.from("notifications").insert({
          user_id: contest.client_id,
          type: "contest_reminder",
          title: scheduledReminder.title,
          message: scheduledReminder.message(contest.title),
          contract_id: null,
        });
        results.push({ contest_id: contest.id, action: `reminder_day_${daysSinceDeadline}` });
        continue;
      }

      // Weekly escalation after day 21 (every 7 days: 28, 35, 42, …)
      if (daysSinceDeadline > 21 && (daysSinceDeadline - 21) % 7 === 0) {
        await supabase.from("notifications").insert({
          user_id: contest.client_id,
          type: "contest_reminder",
          title: WEEKLY_ESCALATION_TITLE,
          message: weeklyEscalationMessage(contest.title, daysSinceDeadline),
          contract_id: null,
        });
        results.push({ contest_id: contest.id, action: `escalation_day_${daysSinceDeadline}` });
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
