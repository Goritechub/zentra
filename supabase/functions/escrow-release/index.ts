import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYSTACK_BASE = "https://api.paystack.co";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function notify(supabase: any, userId: string, type: string, title: string, message: string, contractId?: string) {
  await supabase.from("notifications").insert({
    user_id: userId, type, title, message, contract_id: contractId || null,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action, milestone_id, contract_id, reason, evidence_urls, submission_notes, submission_attachments, dispute_id, resolution_type, resolution_explanation, split_client, split_freelancer } = body;

    // ── FUND MILESTONE (atomic RPC) ──
    if (action === "fund_milestone") {
      const { data: result, error } = await supabase.rpc("fund_milestone_atomic", {
        _user_id: user.id,
        _milestone_id: milestone_id,
      });

      if (error) {
        console.error("fund_milestone_atomic error:", error);
        return jsonResponse({ error: error.message }, 500);
      }
      if (!result?.success) {
        return jsonResponse({ error: result?.error || "Funding failed" }, 400);
      }

      // Non-critical side effects (notifications, chat messages)
      await notify(supabase, result.freelancer_id, "milestone_funded",
        "Milestone Funded",
        `Milestone "${result.milestone_title}" has been funded with ${formatAmount(result.amount)}. You can start working!`,
        result.contract_id);

      await supabase.from("contract_messages").insert({
        contract_id: result.contract_id,
        sender_id: user.id,
        content: `💰 Milestone "${result.milestone_title}" funded with ${formatAmount(result.amount)}. Funds are held in escrow.`,
        is_system_message: true,
      });

      return jsonResponse({ success: true });
    }

    // ── SUBMIT DELIVERY (no financial operation — unchanged) ──
    if (action === "submit_delivery") {
      const { data: milestone } = await supabase
        .from("milestones")
        .select("*, contract:contracts!milestones_contract_id_fkey(*)")
        .eq("id", milestone_id)
        .single();

      if (!milestone || milestone.contract.freelancer_id !== user.id)
        return jsonResponse({ error: "Not authorized" }, 403);

      if (milestone.status !== "funded" && milestone.status !== "in_progress")
        return jsonResponse({ error: "Milestone not ready for delivery" }, 400);

      await supabase.from("milestones").update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        submission_notes: submission_notes || null,
        submission_attachments: submission_attachments || [],
      }).eq("id", milestone_id);

      await notify(supabase, milestone.contract.client_id, "milestone_submitted",
        "Delivery Submitted",
        `Expert has submitted work for milestone "${milestone.title}". Please review and approve.`,
        milestone.contract_id);

      await supabase.from("contract_messages").insert({
        contract_id: milestone.contract_id,
        sender_id: user.id,
        content: `📦 Delivery submitted for milestone "${milestone.title}". Awaiting client review.`,
        is_system_message: true,
      });

      return jsonResponse({ success: true });
    }

    // ── APPROVE & RELEASE (atomic RPC) ──
    if (action === "approve_release") {
      const { data: result, error } = await supabase.rpc("release_milestone_atomic", {
        _user_id: user.id,
        _milestone_id: milestone_id,
      });

      if (error) {
        console.error("release_milestone_atomic error:", error);
        return jsonResponse({ error: error.message }, 500);
      }
      if (!result?.success) {
        return jsonResponse({ error: result?.error || "Release failed" }, 400);
      }

      // Non-critical side effects
      await notify(supabase, result.freelancer_id, "payment_released",
        "Payment Released!",
        `${formatAmount(result.expert_amount)} has been released for milestone "${result.milestone_title}" (${(result.commission_rate * 100).toFixed(0)}% platform fee applied). Funds will be available for withdrawal after 48 hours.`,
        result.contract_id);

      await supabase.from("contract_messages").insert({
        contract_id: result.contract_id,
        sender_id: user.id,
        content: `✅ Milestone "${result.milestone_title}" approved. ${formatAmount(result.amount)} has been released.`,
        is_system_message: true,
      });

      // Attempt Paystack payout
      await attemptPaystackPayout(supabase, result);

      if (result.all_approved) {
        await notify(supabase, result.client_id, "contract_completed",
          "Contract Completed", "All milestones approved. Contract is now complete!", result.contract_id);
        await notify(supabase, result.freelancer_id, "contract_completed",
          "Contract Completed", "All milestones approved. Contract is now complete!", result.contract_id);
      }

      return jsonResponse({ success: true, commission: result.platform_fee, netToFreelancer: result.expert_amount });
    }

    // ── RAISE DISPUTE (no financial operation — unchanged) ──
    if (action === "raise_dispute") {
      if (!contract_id || !reason)
        return jsonResponse({ error: "Missing contract_id or reason" }, 400);

      const { data: contract } = await supabase.from("contracts").select("*").eq("id", contract_id).single();
      if (!contract || (contract.client_id !== user.id && contract.freelancer_id !== user.id))
        return jsonResponse({ error: "Not authorized" }, 403);

      await supabase.from("contracts").update({ status: "disputed" }).eq("id", contract_id);

      if (milestone_id) {
        await supabase.from("milestones").update({ status: "disputed" }).eq("id", milestone_id);
      }

      const respondent = contract.client_id === user.id ? contract.freelancer_id : contract.client_id;
      const responseDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const { data: dispute } = await supabase.from("disputes").insert({
        contract_id,
        milestone_id: milestone_id || null,
        raised_by: user.id,
        respondent_id: respondent,
        reason,
        evidence_urls: evidence_urls || [],
        dispute_status: "awaiting_response",
        response_deadline: responseDeadline,
      }).select().single();

      await notify(supabase, respondent, "dispute_opened",
        "Dispute Raised — Response Required",
        `A dispute has been raised. You have 48 hours to respond with your explanation and evidence. Reason: ${reason.substring(0, 100)}...`,
        contract_id);

      await supabase.from("contract_messages").insert({
        contract_id,
        sender_id: user.id,
        content: `⚠️ Dispute raised. Funds are frozen until resolved. The other party has 48 hours to respond. Reason: ${reason}`,
        is_system_message: true,
      });

      return jsonResponse({ success: true, dispute });
    }

    // ── RESOLVE DISPUTE (atomic RPC) ──
    if (action === "resolve_dispute") {
      if (!dispute_id || !contract_id || !resolution_explanation)
        return jsonResponse({ error: "Missing required fields" }, 400);

      // Defense-in-depth: verify caller is admin before invoking RPC
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        return jsonResponse({ error: "Only admins can resolve disputes" }, 403);
      }

      const { data: result, error } = await supabase.rpc("resolve_dispute_atomic", {
        _admin_id: user.id,
        _dispute_id: dispute_id,
        _contract_id: contract_id,
        _resolution_type: resolution_type || "no_funds",
        _resolution_explanation: resolution_explanation,
        _split_client: split_client || 0,
        _split_freelancer: split_freelancer || 0,
      });

      if (error) {
        console.error("resolve_dispute_atomic error:", error);
        return jsonResponse({ error: error.message }, 500);
      }
      if (!result?.success) {
        return jsonResponse({ error: result?.error || "Resolution failed" }, 400);
      }

      // Non-critical: notifications
      const resLabel = resolution_type === "release_to_freelancer" ? "Funds released to expert" :
        resolution_type === "refund_client" ? "Funds refunded to client" : "Funds split between parties";

      await notify(supabase, result.client_id, "dispute_resolved",
        "Dispute Resolved", `Decision: ${resLabel}. ${resolution_explanation.substring(0, 150)}`, contract_id);
      await notify(supabase, result.freelancer_id, "dispute_resolved",
        "Dispute Resolved", `Decision: ${resLabel}. ${resolution_explanation.substring(0, 150)}`, contract_id);

      await supabase.from("contract_messages").insert({
        contract_id, sender_id: user.id,
        content: `⚖️ Dispute resolved by ZentraGig adjudicator. Decision: ${resLabel}.`,
        is_system_message: true,
      });

      return jsonResponse({ success: true });
    }

    // ── REJECT MILESTONE (no financial operation — unchanged) ──
    if (action === "reject_milestone") {
      const rejectionReason = body.rejection_reason || "Work does not meet requirements";
      const { data: milestone } = await supabase
        .from("milestones")
        .select("*, contract:contracts!milestones_contract_id_fkey(*)")
        .eq("id", milestone_id)
        .single();

      if (!milestone || milestone.contract.client_id !== user.id)
        return jsonResponse({ error: "Not authorized" }, 403);

      if (milestone.status !== "submitted")
        return jsonResponse({ error: "Milestone not submitted" }, 400);

      await supabase.from("milestones").update({
        status: "funded",
        submitted_at: null,
        submission_notes: null,
        submission_attachments: [],
      }).eq("id", milestone_id);

      await notify(supabase, milestone.contract.freelancer_id, "milestone_rejected",
        "Milestone Rejected",
        `Your submission for "${milestone.title}" was rejected. Reason: ${rejectionReason}`,
        milestone.contract_id);

      await supabase.from("contract_messages").insert({
        contract_id: milestone.contract_id,
        sender_id: user.id,
        content: `❌ Milestone "${milestone.title}" rejected. Reason: ${rejectionReason}`,
        is_system_message: true,
      });

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("Escrow error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

function formatAmount(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

async function attemptPaystackPayout(supabase: any, result: any) {
  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) return;

    const { data: bankDetail } = await supabase.from("bank_details")
      .select("*")
      .eq("user_id", result.freelancer_id)
      .eq("is_default", true)
      .single();

    if (!bankDetail?.recipient_code) return;

    const transferRes = await fetch(`${PAYSTACK_BASE}/transfer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: result.expert_amount * 100,
        recipient: bankDetail.recipient_code,
        reason: `Payment for milestone: ${result.milestone_title}`,
      }),
    });
    const transferData = await transferRes.json();

    const status = transferData.status ? "pending" : "failed";

    await supabase.from("payout_transfers").insert({
      contract_id: result.contract_id,
      milestone_id: result.milestone_id || null,
      expert_id: result.freelancer_id,
      transfer_code: transferData.data?.transfer_code || null,
      amount: result.expert_amount,
      platform_fee: result.platform_fee,
      status,
      paystack_response: transferData.data || null,
    });

    if (status === "failed") {
      console.error("Paystack transfer failed:", transferData.message);
    }
  } catch (err) {
    console.error("Paystack payout error:", err);
  }
}
