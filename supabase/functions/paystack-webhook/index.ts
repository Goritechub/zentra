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

    // Verify signature
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
        // Check if already credited (prevent double-credit from check_pending + webhook)
        const { data: existing } = await supabase.from("wallet_transactions")
          .select("id")
          .eq("reference", reference)
          .eq("user_id", ref.user_id)
          .maybeSingle();

        if (!existing) {
          const amountNaira = Math.round(ref.amount / 100);
          const channelLabel = ref.channel === "card" ? "Card" : ref.channel === "bank" ? "Bank Transfer" : ref.channel === "ussd" ? "USSD" : "Paystack";
          const description = `Wallet funded via ${channelLabel}`;

          const { data: wallet } = await supabase.from("wallets")
            .select("*")
            .eq("user_id", ref.user_id)
            .maybeSingle();

          if (wallet) {
            await supabase.from("wallets").update({
              balance: wallet.balance + amountNaira,
            }).eq("user_id", ref.user_id);
          } else {
            await supabase.from("wallets").insert({
              user_id: ref.user_id,
              balance: amountNaira,
            });
          }

          await supabase.from("wallet_transactions").insert({
            user_id: ref.user_id,
            type: "credit",
            amount: amountNaira,
            balance_after: (wallet?.balance || 0) + amountNaira,
            description,
            reference,
          });

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

      // Update payout_transfers
      const { data: payout } = await supabase.from("payout_transfers")
        .select("*")
        .eq("transfer_code", transferCode)
        .single();

      if (payout) {
        await supabase.from("payout_transfers").update({
          status: "success",
          completed_at: new Date().toISOString(),
          paystack_response: event.data,
        }).eq("id", payout.id);

        // Update milestone to paid
        if (payout.milestone_id) {
          await supabase.from("milestones").update({ status: "paid" }).eq("id", payout.milestone_id);
        }

        // Notify expert
        await supabase.from("notifications").insert({
          user_id: payout.expert_id,
          type: "payout_success",
          title: "Bank Transfer Completed",
          message: `₦${payout.amount.toLocaleString()} has been transferred to your bank account.`,
          contract_id: payout.contract_id,
        });
      }
    }

    // ── transfer.failed ──
    if (event.event === "transfer.failed") {
      const transferCode = event.data?.transfer_code;
      if (!transferCode) return new Response("OK", { status: 200 });

      const { data: payout } = await supabase.from("payout_transfers")
        .select("*")
        .eq("transfer_code", transferCode)
        .single();

      if (payout) {
        await supabase.from("payout_transfers").update({
          status: "failed",
          paystack_response: event.data,
        }).eq("id", payout.id);

        // Notify expert
        await supabase.from("notifications").insert({
          user_id: payout.expert_id,
          type: "payout_failed",
          title: "Bank Transfer Failed",
          message: `Transfer of ₦${payout.amount.toLocaleString()} to your bank failed. Funds remain in your wallet.`,
          contract_id: payout.contract_id,
        });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Server error", { status: 500 });
  }
});
