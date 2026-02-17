import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Platform commission tiers (Naira) – aligned with service-charge.ts
function getCommissionRate(amount: number): number {
  if (amount <= 1_000_000) return 0.18;
  if (amount <= 5_000_000) return 0.15;
  if (amount <= 10_000_000) return 0.10;
  return 0.07;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, milestone_id, contract_id, reason, evidence_urls, submission_notes, submission_attachments } = await req.json();

    // ── FUND MILESTONE ──────────────────────────────────────────
    if (action === "fund_milestone") {
      const { data: milestone } = await supabase
        .from("milestones")
        .select("*, contract:contracts!milestones_contract_id_fkey(*)")
        .eq("id", milestone_id)
        .single();

      if (!milestone || milestone.contract.client_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (milestone.status !== "pending") {
        return new Response(JSON.stringify({ error: "Milestone already funded" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check wallet balance
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!wallet || wallet.balance < milestone.amount) {
        return new Response(JSON.stringify({ error: "Insufficient balance" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Lock funds
      await supabase.from("wallets").update({
        balance: wallet.balance - milestone.amount,
        escrow_balance: wallet.escrow_balance + milestone.amount,
        total_spent: wallet.total_spent + milestone.amount,
      }).eq("user_id", user.id);

      // Record transaction
      await supabase.from("wallet_transactions").insert({
        user_id: user.id,
        type: "escrow_lock",
        amount: milestone.amount,
        balance_after: wallet.balance - milestone.amount,
        description: `Funded milestone: ${milestone.title}`,
        contract_id: milestone.contract_id,
        milestone_id: milestone.id,
      });

      // Update milestone
      await supabase.from("milestones").update({
        status: "funded",
        funded_at: new Date().toISOString(),
      }).eq("id", milestone_id);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SUBMIT DELIVERY ─────────────────────────────────────────
    if (action === "submit_delivery") {
      const { data: milestone } = await supabase
        .from("milestones")
        .select("*, contract:contracts!milestones_contract_id_fkey(*)")
        .eq("id", milestone_id)
        .single();

      if (!milestone || milestone.contract.freelancer_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (milestone.status !== "funded" && milestone.status !== "in_progress") {
        return new Response(JSON.stringify({ error: "Milestone not ready for delivery" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("milestones").update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        submission_notes: submission_notes || null,
        submission_attachments: submission_attachments || [],
      }).eq("id", milestone_id);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── APPROVE & RELEASE ───────────────────────────────────────
    if (action === "approve_release") {
      const { data: milestone } = await supabase
        .from("milestones")
        .select("*, contract:contracts!milestones_contract_id_fkey(*)")
        .eq("id", milestone_id)
        .single();

      if (!milestone || milestone.contract.client_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (milestone.status !== "submitted") {
        return new Response(JSON.stringify({ error: "Milestone not submitted for approval" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const commissionRate = getCommissionRate(milestone.amount);
      const commissionAmount = Math.round(milestone.amount * commissionRate);
      const netToFreelancer = milestone.amount - commissionAmount;

      // Release from client escrow
      const { data: clientWallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", milestone.contract.client_id)
        .single();

      if (clientWallet) {
        await supabase.from("wallets").update({
          escrow_balance: clientWallet.escrow_balance - milestone.amount,
        }).eq("user_id", milestone.contract.client_id);
      }

      // Credit freelancer
      const { data: flWallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", milestone.contract.freelancer_id)
        .maybeSingle();

      if (flWallet) {
        await supabase.from("wallets").update({
          balance: flWallet.balance + netToFreelancer,
          total_earned: flWallet.total_earned + netToFreelancer,
        }).eq("user_id", milestone.contract.freelancer_id);
      } else {
        await supabase.from("wallets").insert({
          user_id: milestone.contract.freelancer_id,
          balance: netToFreelancer,
          total_earned: netToFreelancer,
        });
      }

      // Record transactions
      await supabase.from("wallet_transactions").insert([
        {
          user_id: milestone.contract.client_id,
          type: "escrow_release",
          amount: milestone.amount,
          balance_after: (clientWallet?.escrow_balance || 0) - milestone.amount,
          description: `Released milestone: ${milestone.title}`,
          contract_id: milestone.contract_id,
          milestone_id: milestone.id,
        },
        {
          user_id: milestone.contract.freelancer_id,
          type: "escrow_release",
          amount: netToFreelancer,
          balance_after: (flWallet?.balance || 0) + netToFreelancer,
          description: `Payment received: ${milestone.title} (after ${(commissionRate * 100).toFixed(0)}% fee)`,
          contract_id: milestone.contract_id,
          milestone_id: milestone.id,
        },
      ]);

      // Record platform revenue
      await supabase.from("platform_revenue").insert({
        contract_id: milestone.contract_id,
        milestone_id: milestone.id,
        gross_amount: milestone.amount,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        net_to_freelancer: netToFreelancer,
      });

      // Update milestone
      await supabase.from("milestones").update({
        status: "approved",
        approved_at: new Date().toISOString(),
      }).eq("id", milestone_id);

      // Check if all milestones are approved → complete contract
      const { data: allMilestones } = await supabase
        .from("milestones")
        .select("status")
        .eq("contract_id", milestone.contract_id);

      const allApproved = allMilestones?.every((m: any) => m.status === "approved");
      if (allApproved) {
        await supabase.from("contracts").update({
          status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", milestone.contract_id);
      }

      return new Response(JSON.stringify({ success: true, commission: commissionAmount, netToFreelancer }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RAISE DISPUTE ───────────────────────────────────────────
    if (action === "raise_dispute") {
      if (!contract_id || !reason) {
        return new Response(JSON.stringify({ error: "Missing contract_id or reason" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: contract } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", contract_id)
        .single();

      if (!contract || (contract.client_id !== user.id && contract.freelancer_id !== user.id)) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("contracts").update({ status: "disputed" }).eq("id", contract_id);

      // Update milestone if provided
      if (milestone_id) {
        await supabase.from("milestones").update({ status: "disputed" }).eq("id", milestone_id);
      }

      const { data: dispute } = await supabase.from("disputes").insert({
        contract_id,
        milestone_id: milestone_id || null,
        raised_by: user.id,
        reason,
        evidence_urls: evidence_urls || [],
      }).select().single();

      return new Response(JSON.stringify({ success: true, dispute }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Server error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
