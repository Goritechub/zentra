import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYSTACK_BASE = "https://api.paystack.co";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Paystack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const body = await req.json();
    const { action } = body;

    // ── LIST BANKS ──
    if (action === "list_banks") {
      const res = await fetch(`${PAYSTACK_BASE}/bank?country=nigeria`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const data = await res.json();
      return new Response(JSON.stringify({ success: true, banks: data.data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RESOLVE ACCOUNT ──
    if (action === "resolve_account") {
      const { account_number, bank_code } = body;
      const res = await fetch(
        `${PAYSTACK_BASE}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
      );
      const data = await res.json();
      return new Response(JSON.stringify({ success: data.status, data: data.data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CREATE TRANSFER RECIPIENT & SAVE BANK DETAILS ──
    if (action === "save_bank") {
      const { account_number, bank_code, bank_name, account_name } = body;

      // Create Paystack transfer recipient
      const recipientRes = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "nuban",
          name: account_name,
          account_number,
          bank_code,
          currency: "NGN",
        }),
      });
      const recipientData = await recipientRes.json();

      if (!recipientData.status) {
        return new Response(JSON.stringify({ error: recipientData.message || "Failed to create recipient" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Unset other defaults
      await supabase.from("bank_details").update({ is_default: false }).eq("user_id", user.id);

      // Save to DB
      const { data: bankDetail, error } = await supabase.from("bank_details").upsert({
        user_id: user.id,
        bank_code,
        bank_name,
        account_number,
        account_name,
        recipient_code: recipientData.data.recipient_code,
        is_default: true,
      }, { onConflict: "user_id,bank_code,account_number" }).select().single();

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to save bank details" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, bank_detail: bankDetail }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── INITIATE WITHDRAWAL ──
    if (action === "withdraw") {
      const { amount, bank_detail_id } = body;
      // amount in Naira from frontend

      // Check wallet balance
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!wallet || wallet.balance < amount) {
        return new Response(JSON.stringify({ error: "Insufficient balance" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get bank details
      const { data: bankDetail } = await supabase
        .from("bank_details")
        .select("*")
        .eq("id", bank_detail_id)
        .eq("user_id", user.id)
        .single();

      if (!bankDetail?.recipient_code) {
        return new Response(JSON.stringify({ error: "Bank details not found or invalid" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Debit wallet first
      await supabase.from("wallets").update({
        balance: wallet.balance - amount,
      }).eq("user_id", user.id);

      // Initiate Paystack transfer (amount in kobo)
      const transferRes = await fetch(`${PAYSTACK_BASE}/transfer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance",
          amount: amount * 100, // convert to kobo
          recipient: bankDetail.recipient_code,
          reason: `Withdrawal from platform wallet`,
        }),
      });
      const transferData = await transferRes.json();

      const status = transferData.status ? "processing" : "failed";
      const transferCode = transferData.data?.transfer_code || null;

      // Save withdrawal request
      await supabase.from("withdrawal_requests").insert({
        user_id: user.id,
        amount: amount, // store in naira
        bank_detail_id,
        transfer_code: transferCode,
        status,
        reason: !transferData.status ? (transferData.message || "Transfer failed") : null,
      });

      // Record wallet transaction
      await supabase.from("wallet_transactions").insert({
        user_id: user.id,
        type: "withdrawal",
        amount,
        balance_after: wallet.balance - amount,
        description: `Withdrawal to ${bankDetail.bank_name} - ${bankDetail.account_number}`,
      });

      // Record in transactions table
      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "debit",
        amount,
        status: status === "processing" ? "pending" : "failed",
        description: `Withdrawal to ${bankDetail.bank_name}`,
        reference: transferCode,
      });

      if (!transferData.status) {
        // Refund wallet on failure
        await supabase.from("wallets").update({
          balance: wallet.balance,
        }).eq("user_id", user.id);

        return new Response(JSON.stringify({ error: transferData.message || "Transfer failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, transfer_code: transferCode }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Paystack transfer error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
