import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYSTACK_BASE = "https://api.paystack.co";

// Updated commission tiers per user spec
function getCommissionRate(amount: number): number {
  if (amount <= 300_000) return 0.20;
  if (amount <= 2_000_000) return 0.15;
  if (amount <= 10_000_000) return 0.10;
  return 0.07;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function notify(supabase: any, userId: string, type: string, title: string, message: string, contractId?: string) {
  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    contract_id: contractId || null,
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
    const { action, milestone_id, contract_id, reason, evidence_urls, submission_notes, submission_attachments } = body;

    // ── FUND MILESTONE ──
    if (action === "fund_milestone") {
      const { data: milestone } = await supabase
        .from("milestones")
        .select("*, contract:contracts!milestones_contract_id_fkey(*)")
        .eq("id", milestone_id)
        .single();

      if (!milestone || milestone.contract.client_id !== user.id)
        return jsonResponse({ error: "Not authorized" }, 403);

      if (milestone.status !== "pending")
        return jsonResponse({ error: "Milestone already funded" }, 400);

      // Check wallet balance
      const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single();
      if (!wallet || wallet.balance < milestone.amount)
        return jsonResponse({ error: "Insufficient balance. Please fund your wallet first." }, 400);

      // Lock funds in escrow
      await supabase.from("wallets").update({
        balance: wallet.balance - milestone.amount,
        escrow_balance: wallet.escrow_balance + milestone.amount,
        total_spent: wallet.total_spent + milestone.amount,
      }).eq("user_id", user.id);

      // Record wallet transaction
      await supabase.from("wallet_transactions").insert({
        user_id: user.id,
        type: "escrow_lock",
        amount: milestone.amount,
        balance_after: wallet.balance - milestone.amount,
        description: `Funded milestone: ${milestone.title}`,
        contract_id: milestone.contract_id,
        milestone_id: milestone.id,
      });

      // Record escrow ledger entry
      await supabase.from("escrow_ledger").insert({
        contract_id: milestone.contract_id,
        milestone_id: milestone.id,
        held_amount: milestone.amount,
        status: "held",
      });

      // Record escrow transaction
      await supabase.from("escrow_transactions").insert({
        contract_id: milestone.contract_id,
        milestone_id: milestone.id,
        payer_id: user.id,
        amount: milestone.amount,
        type: "deposit",
        status: "completed",
      });

      // Update milestone status
      await supabase.from("milestones").update({
        status: "funded",
        funded_at: new Date().toISOString(),
      }).eq("id", milestone_id);

      // Ensure contract is active
      if (milestone.contract.status === "pending_funding" || milestone.contract.status === "interviewing") {
        await supabase.from("contracts").update({ status: "active" }).eq("id", milestone.contract_id);
      }

      // Notify expert
      await notify(supabase, milestone.contract.freelancer_id, "milestone_funded",
        "Milestone Funded",
        `Milestone "${milestone.title}" has been funded with ${formatAmount(milestone.amount)}. You can start working!`,
        milestone.contract_id);

      // System message in chat
      await supabase.from("contract_messages").insert({
        contract_id: milestone.contract_id,
        sender_id: user.id,
        content: `💰 Milestone "${milestone.title}" funded with ${formatAmount(milestone.amount)}. Funds are held in escrow.`,
        is_system_message: true,
      });

      return jsonResponse({ success: true });
    }

    // ── SUBMIT DELIVERY ──
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

      // Notify client
      await notify(supabase, milestone.contract.client_id, "milestone_submitted",
        "Delivery Submitted",
        `Expert has submitted work for milestone "${milestone.title}". Please review and approve.`,
        milestone.contract_id);

      // System message
      await supabase.from("contract_messages").insert({
        contract_id: milestone.contract_id,
        sender_id: user.id,
        content: `📦 Delivery submitted for milestone "${milestone.title}". Awaiting client review.`,
        is_system_message: true,
      });

      return jsonResponse({ success: true });
    }

    // ── APPROVE & RELEASE ──
    if (action === "approve_release") {
      const { data: milestone } = await supabase
        .from("milestones")
        .select("*, contract:contracts!milestones_contract_id_fkey(*)")
        .eq("id", milestone_id)
        .single();

      if (!milestone || milestone.contract.client_id !== user.id)
        return jsonResponse({ error: "Not authorized" }, 403);

      if (milestone.status !== "submitted")
        return jsonResponse({ error: "Milestone not submitted for approval" }, 400);

      // Verify escrow ledger entry exists and is held, or create one if missing
      let { data: ledgerEntry } = await supabase.from("escrow_ledger")
        .select("*")
        .eq("milestone_id", milestone.id)
        .eq("status", "held")
        .single();

      // If no ledger entry exists (e.g. milestone funded before escrow tracking), create one
      if (!ledgerEntry) {
        const { data: newLedger, error: ledgerErr } = await supabase.from("escrow_ledger").insert({
          contract_id: milestone.contract_id,
          milestone_id: milestone.id,
          held_amount: milestone.amount,
          status: "held",
        }).select().single();

        if (ledgerErr || !newLedger) {
          console.error("Failed to create escrow ledger entry:", ledgerErr);
          return jsonResponse({ error: "Failed to create escrow tracking record" }, 500);
        }
        ledgerEntry = newLedger;
      }

      const commissionRate = getCommissionRate(milestone.amount);
      const platformFee = Math.round(milestone.amount * commissionRate);
      const expertAmount = milestone.amount - platformFee;

      // Release from client escrow
      const { data: clientWallet } = await supabase.from("wallets").select("*").eq("user_id", milestone.contract.client_id).single();
      if (clientWallet) {
        await supabase.from("wallets").update({
          escrow_balance: clientWallet.escrow_balance - milestone.amount,
        }).eq("user_id", milestone.contract.client_id);
      }

      // Credit freelancer wallet
      const { data: flWallet } = await supabase.from("wallets").select("*").eq("user_id", milestone.contract.freelancer_id).maybeSingle();
      if (flWallet) {
        await supabase.from("wallets").update({
          balance: flWallet.balance + expertAmount,
          total_earned: flWallet.total_earned + expertAmount,
        }).eq("user_id", milestone.contract.freelancer_id);
      } else {
        await supabase.from("wallets").insert({
          user_id: milestone.contract.freelancer_id,
          balance: expertAmount,
          total_earned: expertAmount,
        });
      }

      // Update escrow ledger
      await supabase.from("escrow_ledger").update({
        released_amount: milestone.amount,
        platform_fee: platformFee,
        expert_amount: expertAmount,
        status: "released",
        updated_at: new Date().toISOString(),
      }).eq("id", ledgerEntry.id);

      // Record wallet transactions
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
          amount: expertAmount,
          balance_after: (flWallet?.balance || 0) + expertAmount,
          description: `Payment received: ${milestone.title}`,
          contract_id: milestone.contract_id,
          milestone_id: milestone.id,
        },
      ]);

      // Record escrow transaction
      await supabase.from("escrow_transactions").insert({
        contract_id: milestone.contract_id,
        milestone_id: milestone.id,
        payer_id: milestone.contract.client_id,
        payee_id: milestone.contract.freelancer_id,
        amount: expertAmount,
        type: "release",
        status: "completed",
      });

      // Record platform revenue
      await supabase.from("platform_revenue").insert({
        contract_id: milestone.contract_id,
        milestone_id: milestone.id,
        gross_amount: milestone.amount,
        commission_rate: commissionRate,
        commission_amount: platformFee,
        net_to_freelancer: expertAmount,
      });

      // Update milestone
      await supabase.from("milestones").update({
        status: "approved",
        approved_at: new Date().toISOString(),
      }).eq("id", milestone_id);

      // Notify expert
      await notify(supabase, milestone.contract.freelancer_id, "payment_released",
        "Payment Released!",
        `${formatAmount(expertAmount)} has been released to your wallet for milestone "${milestone.title}" (${(commissionRate * 100).toFixed(0)}% platform fee applied).`,
        milestone.contract_id);

      // System message (no fee details - visible to both parties)
      await supabase.from("contract_messages").insert({
        contract_id: milestone.contract_id,
        sender_id: user.id,
        content: `✅ Milestone "${milestone.title}" approved. ${formatAmount(milestone.amount)} has been released.`,
        is_system_message: true,
      });

      // Attempt Paystack payout if expert has bank details
      await attemptPaystackPayout(supabase, milestone, expertAmount, platformFee);

      // Check if all milestones are approved → complete contract
      const { data: allMilestones } = await supabase.from("milestones").select("status").eq("contract_id", milestone.contract_id);
      const allApproved = allMilestones?.every((m: any) => m.status === "approved");
      if (allApproved) {
        await supabase.from("contracts").update({
          status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", milestone.contract_id);

        // Notify both parties
        await notify(supabase, milestone.contract.client_id, "contract_completed",
          "Contract Completed", "All milestones approved. Contract is now complete!", milestone.contract_id);
        await notify(supabase, milestone.contract.freelancer_id, "contract_completed",
          "Contract Completed", "All milestones approved. Contract is now complete!", milestone.contract_id);
      }

      return jsonResponse({ success: true, commission: platformFee, netToFreelancer: expertAmount });
    }

    // ── RAISE DISPUTE ──
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

      const { data: dispute } = await supabase.from("disputes").insert({
        contract_id,
        milestone_id: milestone_id || null,
        raised_by: user.id,
        reason,
        evidence_urls: evidence_urls || [],
      }).select().single();

      // Notify the other party
      const otherParty = contract.client_id === user.id ? contract.freelancer_id : contract.client_id;
      await notify(supabase, otherParty, "dispute_opened",
        "Dispute Raised", `A dispute has been raised on the contract. Reason: ${reason.substring(0, 100)}...`, contract_id);

      // System message
      await supabase.from("contract_messages").insert({
        contract_id,
        sender_id: user.id,
        content: `⚠️ Dispute raised. Funds are frozen until resolved. Reason: ${reason}`,
        is_system_message: true,
      });

      return jsonResponse({ success: true, dispute });
    }

    // ── REJECT MILESTONE ──
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
        status: "funded", // Reset to funded so expert can resubmit
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

async function attemptPaystackPayout(supabase: any, milestone: any, expertAmount: number, platformFee: number) {
  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) return;

    // Get expert's default bank details
    const { data: bankDetail } = await supabase.from("bank_details")
      .select("*")
      .eq("user_id", milestone.contract.freelancer_id)
      .eq("is_default", true)
      .single();

    if (!bankDetail?.recipient_code) {
      // No bank details — funds stay in wallet, expert can withdraw manually
      return;
    }

    // Initiate Paystack transfer
    const transferRes = await fetch(`${PAYSTACK_BASE}/transfer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: expertAmount * 100, // kobo
        recipient: bankDetail.recipient_code,
        reason: `Payment for milestone: ${milestone.title}`,
      }),
    });
    const transferData = await transferRes.json();

    const status = transferData.status ? "pending" : "failed";

    // Record payout transfer
    await supabase.from("payout_transfers").insert({
      contract_id: milestone.contract_id,
      milestone_id: milestone.id,
      expert_id: milestone.contract.freelancer_id,
      transfer_code: transferData.data?.transfer_code || null,
      amount: expertAmount,
      platform_fee: platformFee,
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
