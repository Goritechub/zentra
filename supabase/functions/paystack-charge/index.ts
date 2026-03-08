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
      const { amount, channel, bank, ussd, email, card } = body;
      const reference = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // For card payments, use Transaction Initialize API (redirects to Paystack checkout)
      if (channel === "card") {
        const initBody: any = {
          email: email || user.email,
          amount: String(amount),
          reference,
          callback_url: body.callback_url || undefined,
          metadata: {
            user_id: user.id,
            purpose: body.purpose || "wallet_funding",
            custom_fields: [
              { display_name: "User ID", variable_name: "user_id", value: user.id },
            ],
          },
          channels: ["card"],
        };

        const paystackRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(initBody),
        });

        const paystackData = await paystackRes.json();

        // Save reference to DB
        await supabase.from("paystack_references").insert({
          user_id: user.id,
          reference,
          amount: parseInt(String(amount)),
          channel: "card",
          status: "open_url",
          paystack_response: paystackData.data,
          purpose: body.purpose || "wallet_funding",
          contract_id: body.contract_id || null,
          milestone_id: body.milestone_id || null,
        });

        return new Response(JSON.stringify({
          success: true,
          status: "open_url",
          reference,
          data: { url: paystackData.data?.authorization_url, ...paystackData.data },
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For bank payments, use Transaction Initialize with bank channel
      if (channel === "bank") {
        const initBody: any = {
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
          channels: ["bank", "bank_transfer"],
        };

        const paystackRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(initBody),
        });

        const paystackData = await paystackRes.json();

        await supabase.from("paystack_references").insert({
          user_id: user.id,
          reference,
          amount: parseInt(String(amount)),
          channel: "bank",
          status: "open_url",
          paystack_response: paystackData.data,
          purpose: body.purpose || "wallet_funding",
          contract_id: body.contract_id || null,
          milestone_id: body.milestone_id || null,
        });

        return new Response(JSON.stringify({
          success: true,
          status: "open_url",
          reference,
          data: { url: paystackData.data?.authorization_url, ...paystackData.data },
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For USSD, keep using Charge API
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

      if (channel === "ussd" && ussd) {
        chargeBody.ussd = ussd;
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

      let internalStatus = "pending";
      if (paystackData.data?.status === "success") internalStatus = "success";
      else if (paystackData.data?.status === "send_pin") internalStatus = "send_pin";
      else if (paystackData.data?.status === "send_otp") internalStatus = "send_otp";
      else if (paystackData.data?.status === "send_phone") internalStatus = "send_phone";
      else if (paystackData.data?.status === "send_birthday") internalStatus = "send_birthday";
      else if (paystackData.data?.status === "send_address") internalStatus = "send_address";
      else if (paystackData.data?.status === "open_url") internalStatus = "open_url";
      else if (paystackData.data?.status === "pay_offline") internalStatus = "pay_offline";

      await supabase.from("paystack_references").insert({
        user_id: user.id,
        reference,
        amount: parseInt(String(amount)),
        channel: channel || "ussd",
        status: internalStatus,
        paystack_response: paystackData.data,
        purpose: body.purpose || "wallet_funding",
        contract_id: body.contract_id || null,
        milestone_id: body.milestone_id || null,
      });

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
      // Try verify transaction first (works for initialized transactions)
      const verifyRes = await fetch(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const verifyData = await verifyRes.json();
      
      if (verifyData.data?.status) {
        return await handleChargeResponse(supabase, user.id, reference, verifyData, body.purpose);
      }

      // Fallback to charge endpoint
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
    const { data: ref } = await supabase.from("paystack_references").select("*").eq("reference", reference).single();
    if (ref) {
      // Check if already credited (prevent double-credit from webhook + check_pending)
      const { data: existing } = await supabase.from("wallet_transactions")
        .select("id")
        .eq("reference", reference)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) {
        await creditWallet(supabase, userId, ref.amount, reference, ref.purpose, ref.channel);
      }
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

async function creditWallet(supabase: any, userId: string, amountKobo: number, reference: string, purpose?: string, channel?: string) {
  const amountNaira = Math.round(amountKobo / 100);

  const channelLabel = channel === "card" ? "Card" : channel === "bank" ? "Bank Transfer" : channel === "ussd" ? "USSD" : "Paystack";
  const description = `Wallet funded via ${channelLabel}`;

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

  const { error: wtError } = await supabase.from("wallet_transactions").insert({
    user_id: userId,
    type: "credit",
    amount: amountNaira,
    balance_after: (wallet?.balance || 0) + amountNaira,
    description,
    reference,
  });
  if (wtError) console.error("wallet_transactions insert error:", JSON.stringify(wtError));
}
