import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find interviewing contracts older than 25 business days (~35 calendar days)
    // Business days ≈ calendar days * 5/7, so 25 business days ≈ 35 calendar days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 35);

    const { data: staleContracts, error: fetchError } = await supabase
      .from("contracts")
      .select("id, job_title, client_id, freelancer_id, status")
      .in("status", ["interviewing", "draft", "pending_funding"])
      .lt("created_at", cutoffDate.toISOString());

    if (fetchError) throw fetchError;

    if (!staleContracts || staleContracts.length === 0) {
      return new Response(JSON.stringify({ closed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let closedCount = 0;

    for (const contract of staleContracts) {
      // Delete all FK-dependent records
      const { data: milestoneIds } = await supabase.from("milestones").select("id").eq("contract_id", contract.id);
      const { data: disputeIds } = await supabase.from("disputes").select("id").eq("contract_id", contract.id);
      
      if (milestoneIds?.length) {
        const msIds = milestoneIds.map((m: any) => m.id);
        await supabase.from("milestone_submissions").delete().in("milestone_id", msIds);
      }
      if (disputeIds?.length) {
        const dIds = disputeIds.map((d: any) => d.id);
        await supabase.from("dispute_messages").delete().in("dispute_id", dIds);
      }

      await Promise.all([
        supabase.from("contract_attachments").delete().eq("contract_id", contract.id),
        supabase.from("contract_messages").delete().eq("contract_id", contract.id),
        supabase.from("escrow_ledger").delete().eq("contract_id", contract.id),
        supabase.from("escrow_transactions").delete().eq("contract_id", contract.id),
        supabase.from("hidden_conversations").delete().eq("contract_id", contract.id),
        supabase.from("disputes").delete().eq("contract_id", contract.id),
        supabase.from("payout_transfers").delete().eq("contract_id", contract.id),
        supabase.from("reviews").delete().eq("contract_id", contract.id),
        supabase.from("notifications").delete().eq("contract_id", contract.id),
        supabase.from("milestones").delete().eq("contract_id", contract.id),
      ]);

      // Delete the contract
      const { error: deleteError } = await supabase
        .from("contracts")
        .delete()
        .eq("id", contract.id);

      if (deleteError) {
        console.error(`Failed to delete contract ${contract.id}:`, deleteError);
        continue;
      }

      // Notify both parties
      const message = `Your contract for "${contract.job_title || "a project"}" has been automatically closed after 25 working days of inactivity. If you'd like to continue, please create a new contract.`;

      await Promise.all([
        supabase.from("notifications").insert({
          user_id: contract.client_id,
          type: "contract_auto_closed",
          title: "Contract Auto-Closed",
          message,
          link_url: "/contracts",
        }),
        supabase.from("notifications").insert({
          user_id: contract.freelancer_id,
          type: "contract_auto_closed",
          title: "Contract Auto-Closed",
          message,
          link_url: "/contracts",
        }),
      ]);

      closedCount++;
    }

    return new Response(JSON.stringify({ closed: closedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Auto-close error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
