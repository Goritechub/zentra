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

    // Auth
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

    // ── INITIATE CHARGE ──
    if (action === "initiate") {
      const { amount, channel, bank, ussd, email } = body;
      // amount is in kobo from frontend
      const reference = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const chargeBody: any = {
        email: email || user.email,
        amount: String(amount),
        reference,
        metadata: {
          user_id: user.id,
          purpose: body.purpose || "wallet_funding",
          custom_fields: [
            { display_name: "User ID", variable_name: "user_id", value: user.id },
          ],
        },
      };

      if (channel === "bank" && bank) {
        chargeBody.bank = bank; // { code, account_number }
      }
      if (channel === "ussd" && ussd) {
        chargeBody.ussd = ussd; // { type }
      }

      const paystackRes = await fetch(`${PAYSTACK_BASE}/charge`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chargeBody),
      });

      const paystackData = await paystackRes.json();

      // Map paystack status to our internal status
      let internalStatus = "pending";
      if (paystackData.data?.status === "success") internalStatus = "success";
      else if (paystackData.data?.status === "send_pin") internalStatus = "send_pin";
      else if (paystackData.data?.status === "send_otp") internalStatus = "send_otp";
      else if (paystackData.data?.status === "send_phone") internalStatus = "send_phone";
      else if (paystackData.data?.status === "send_birthday") internalStatus = "send_birthday";
      else if (paystackData.data?.status === "send_address") internalStatus = "send_address";
      else if (paystackData.data?.status === "open_url") internalStatus = "open_url";
      else if (paystackData.data?.status === "pay_offline") internalStatus = "pay_offline";

      // Save reference to DB
      await supabase.from("paystack_references").insert({
        user_id: user.id,
        reference,
        amount: parseInt(String(amount)),
        channel: channel || "card",
        status: internalStatus,
        paystack_response: paystackData.data,
        purpose: body.purpose || "wallet_funding",
        contract_id: body.contract_id || null,
        milestone_id: body.milestone_id || null,
      });

      // If success immediately, credit wallet
      if (internalStatus === "success") {
        await creditWallet(supabase, user.id, parseInt(String(amount)), reference, body.purpose);
      }

      return new Response(JSON.stringify({
        success: true,
        status: internalStatus,
        reference,
        data: paystackData.data,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SUBMIT PIN ──
    if (action === "submit_pin") {
      const { pin, reference } = body;
      const res = await fetch(`${PAYSTACK_BASE}/charge/submit_pin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin, reference }),
      });
      const data = await res.json();
      return await handleChargeResponse(supabase, user.id, reference, data, body.purpose);
    }

    // ── SUBMIT OTP ──
    if (action === "submit_otp") {
      const { otp, reference } = body;
      const res = await fetch(`${PAYSTACK_BASE}/charge/submit_otp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ otp, reference }),
      });
      const data = await res.json();
      return await handleChargeResponse(supabase, user.id, reference, data, body.purpose);
    }

    // ── SUBMIT PHONE ──
    if (action === "submit_phone") {
      const { phone, reference } = body;
      const res = await fetch(`${PAYSTACK_BASE}/charge/submit_phone`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, reference }),
      });
      const data = await res.json();
      return await handleChargeResponse(supabase, user.id, reference, data, body.purpose);
    }

    // ── SUBMIT BIRTHDAY ──
    if (action === "submit_birthday") {
      const { birthday, reference } = body;
      const res = await fetch(`${PAYSTACK_BASE}/charge/submit_birthday`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ birthday, reference }),
      });
      const data = await res.json();
      return await handleChargeResponse(supabase, user.id, reference, data, body.purpose);
    }

    // ── SUBMIT ADDRESS ──
    if (action === "submit_address") {
      const { address, city, state, zipcode, reference } = body;
      const res = await fetch(`${PAYSTACK_BASE}/charge/submit_address`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reference, address, city, state, zip_code: zipcode }),
      });
      const data = await res.json();
      return await handleChargeResponse(supabase, user.id, reference, data, body.purpose);
    }

    // ── CHECK PENDING ──
    if (action === "check_pending") {
      const { reference } = body;
      const res = await fetch(`${PAYSTACK_BASE}/charge/${reference}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const data = await res.json();
      return await handleChargeResponse(supabase, user.id, reference, data, body.purpose);
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Paystack charge error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleChargeResponse(supabase: any, userId: string, reference: string, paystackData: any, purpose?: string) {
  let internalStatus = "pending";
  if (paystackData.data?.status === "success") internalStatus = "success";
  else if (paystackData.data?.status === "failed") internalStatus = "failed";
  else if (paystackData.data?.status) internalStatus = paystackData.data.status;

  await supabase.from("paystack_references").update({
    status: internalStatus,
    paystack_response: paystackData.data,
  }).eq("reference", reference);

  if (internalStatus === "success") {
    // Get the paystack ref to know the amount
    const { data: ref } = await supabase.from("paystack_references").select("*").eq("reference", reference).single();
    if (ref) {
      await creditWallet(supabase, userId, ref.amount, reference, ref.purpose);
    }
  }

  return new Response(JSON.stringify({
    success: true,
    status: internalStatus,
    reference,
    data: paystackData.data,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function creditWallet(supabase: any, userId: string, amountKobo: number, reference: string, purpose?: string) {
  const amountNaira = Math.round(amountKobo / 100);

  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (wallet) {
    await supabase.from("wallets").update({
      balance: wallet.balance + amountNaira,
    }).eq("user_id", userId);
  } else {
    await supabase.from("wallets").insert({
      user_id: userId,
      balance: amountNaira,
    });
  }

  // Record wallet transaction
  await supabase.from("wallet_transactions").insert({
    user_id: userId,
    type: "credit",
    amount: amountNaira,
    balance_after: (wallet?.balance || 0) + amountNaira,
    description: `Wallet funded via Paystack`,
    reference,
  });

  // Also record in transactions table
  await supabase.from("transactions").insert({
    user_id: userId,
    type: "credit",
    amount: amountNaira,
    status: "completed",
    description: `Wallet funding`,
    reference,
  });
}
