import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyPaystackSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hash = new TextDecoder().decode(hexEncode(new Uint8Array(sig)));
  return hash === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response("Not configured", { status: 500 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";

    const isValid = await verifyPaystackSignature(rawBody, signature, PAYSTACK_SECRET_KEY);
    if (!isValid) {
      console.error("Invalid Paystack signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody);
    console.log("Paystack webhook event:", event.event);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── charge.success ──
    if (event.event === "charge.success") {
      const reference = event.data?.reference;
      if (!reference) return new Response("OK", { status: 200 });

      // Update paystack_references
      await supabase.from("paystack_references").update({
        status: "success",
        paystack_response: event.data,
        gateway_response: event.data?.gateway_response || null,
      }).eq("reference", reference);

      // Get the reference record
      const { data: ref } = await supabase.from("paystack_references")
        .select("*")
        .eq("reference", reference)
        .single();

      if (ref && ref.status === "success") {
        const amountNaira = Math.round(ref.amount / 100);
        const channelLabel = ref.channel === "card" ? "Card" : ref.channel === "bank" ? "Bank Transfer" : ref.channel === "ussd" ? "USSD" : "Paystack";
        const description = `Wallet funded via ${channelLabel}`;

        // Use atomic RPC for wallet credit (with built-in idempotency)
        const { data: creditResult, error: creditError } = await supabase.rpc("credit_wallet_atomic", {
          _user_id: ref.user_id,
          _amount: amountNaira,
          _description: description,
          _reference: reference,
        });

        if (creditError) {
          console.error("credit_wallet_atomic error:", creditError);
        } else if (creditResult?.duplicate) {
          console.log("Duplicate credit skipped for reference:", reference);
        } else if (creditResult?.success) {
          await supabase.from("notifications").insert({
            user_id: ref.user_id,
            type: "payment_received",
            title: "Wallet Funded",
            message: `₦${amountNaira.toLocaleString()} has been added to your wallet.`,
          });
        }
      }
    }

    // ── transfer.success ──
    if (event.event === "transfer.success") {
      const transferCode = event.data?.transfer_code;
      if (!transferCode) return new Response("OK", { status: 200 });

      const { data: payout } = await supabase.from("payout_transfers")
        .select("*").eq("transfer_code", transferCode).single();

      if (payout) {
        await supabase.from("payout_transfers").update({
          status: "success",
          completed_at: new Date().toISOString(),
          paystack_response: event.data,
        }).eq("id", payout.id);

        if (payout.milestone_id) {
          await supabase.from("milestones").update({ status: "paid" }).eq("id", payout.milestone_id);
        }

        await supabase.from("notifications").insert({
          user_id: payout.expert_id,
          type: "payout_success",
          title: "Bank Transfer Completed",
          message: `₦${payout.amount.toLocaleString()} has been transferred to your bank account.`,
          contract_id: payout.contract_id,
        });
      }

      // Also finalize withdrawal requests
      const { data: wr } = await supabase.from("withdrawal_requests")
        .select("*").eq("transfer_code", transferCode).maybeSingle();
      if (wr && wr.status !== "completed") {
        await supabase.from("withdrawal_requests").update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", wr.id);
        // Mark pending wallet transaction as completed
        await supabase.from("wallet_transactions")
          .update({ status: "completed" })
          .eq("user_id", wr.user_id)
          .eq("type", "withdrawal")
          .eq("status", "pending")
          .eq("amount", wr.amount);
      }
    }

    // ── transfer.failed ──
    if (event.event === "transfer.failed") {
      const transferCode = event.data?.transfer_code;
      if (!transferCode) return new Response("OK", { status: 200 });

      const { data: payout } = await supabase.from("payout_transfers")
        .select("*").eq("transfer_code", transferCode).single();

      if (payout) {
        await supabase.from("payout_transfers").update({
          status: "failed",
          paystack_response: event.data,
        }).eq("id", payout.id);

        await supabase.from("notifications").insert({
          user_id: payout.expert_id,
          type: "payout_failed",
          title: "Bank Transfer Failed",
          message: `Transfer of ₦${payout.amount.toLocaleString()} to your bank failed. Funds remain in your wallet.`,
          contract_id: payout.contract_id,
        });
      }

      // Also handle withdrawal request failures via webhook
      const { data: wr } = await supabase.from("withdrawal_requests")
        .select("*").eq("transfer_code", transferCode).maybeSingle();
      if (wr && (wr.status === "pending" || wr.status === "processing")) {
        // Use atomic reversal
        const { error: revError } = await supabase.rpc("reverse_withdrawal_atomic", {
          _user_id: wr.user_id,
          _withdrawal_id: wr.id,
          _reference: "withdraw_" + wr.id, // best-effort match
          _reason: event.data?.gateway_response || "Transfer failed via webhook",
        });
        if (revError) console.error("Webhook reverse_withdrawal_atomic error:", revError);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Server error", { status: 500 });
  }
});
