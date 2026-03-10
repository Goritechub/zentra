import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYSTACK_BASE = "https://api.paystack.co";

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return jsonRes({ error: "Paystack not configured" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Missing authorization" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonRes({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action } = body;

    // ── LIST BANKS ──
    if (action === "list_banks") {
      const res = await fetch(`${PAYSTACK_BASE}/bank?country=nigeria`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const data = await res.json();
      return jsonRes({ success: true, banks: data.data });
    }

    // ── RESOLVE ACCOUNT ──
    if (action === "resolve_account") {
      const { account_number, bank_code } = body;
      const res = await fetch(
        `${PAYSTACK_BASE}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
      );
      const data = await res.json();
      return jsonRes({ success: data.status, data: data.data });
    }

    // ── SAVE BANK DETAILS ──
    if (action === "save_bank") {
      const { account_number, bank_code, bank_name, account_name } = body;

      const recipientRes = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "nuban", name: account_name, account_number, bank_code, currency: "NGN",
        }),
      });
      const recipientData = await recipientRes.json();

      if (!recipientData.status) {
        return jsonRes({ error: recipientData.message || "Failed to create recipient" }, 400);
      }

      await supabase.from("bank_details").update({ is_default: false }).eq("user_id", user.id);

      const { data: bankDetail, error } = await supabase.from("bank_details").upsert({
        user_id: user.id, bank_code, bank_name, account_number, account_name,
        recipient_code: recipientData.data.recipient_code, is_default: true,
      }, { onConflict: "user_id,bank_code,account_number" }).select().single();

      if (error) return jsonRes({ error: "Failed to save bank details" }, 500);
      return jsonRes({ success: true, bank_detail: bankDetail });
    }

    // ── INITIATE WITHDRAWAL (atomic RPC) ──
    if (action === "withdraw") {
      const { amount, bank_detail_id } = body;

      // Step 1: Atomic debit via RPC
      const { data: result, error: rpcError } = await supabase.rpc("withdraw_wallet_atomic", {
        _user_id: user.id,
        _amount: amount,
        _bank_detail_id: bank_detail_id,
      });

      if (rpcError) {
        console.error("withdraw_wallet_atomic error:", rpcError);
        return jsonRes({ error: rpcError.message }, 500);
      }
      if (!result?.success) {
        return jsonRes({ error: result?.error || "Withdrawal failed" }, 400);
      }

      // Step 2: Call Paystack
      const transferRes = await fetch(`${PAYSTACK_BASE}/transfer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance",
          amount: amount * 100, // naira to kobo
          recipient: result.recipient_code,
          reason: "Withdrawal from platform wallet",
        }),
      });
      const transferData = await transferRes.json();

      if (!transferData.status) {
        // Step 3: Paystack failed — atomic reversal
        const { error: revError } = await supabase.rpc("reverse_withdrawal_atomic", {
          _user_id: user.id,
          _withdrawal_id: result.withdrawal_id,
          _reference: result.reference,
          _reason: transferData.message || "Transfer failed",
        });
        if (revError) console.error("reverse_withdrawal_atomic error:", revError);

        return jsonRes({ error: transferData.message || "Transfer failed" }, 400);
      }

      // Update withdrawal request with transfer code
      await supabase.from("withdrawal_requests").update({
        transfer_code: transferData.data?.transfer_code || null,
        status: "processing",
      }).eq("id", result.withdrawal_id);

      return jsonRes({ success: true, transfer_code: transferData.data?.transfer_code });
    }

    // ── ADMIN REVENUE WITHDRAWAL ──
    if (action === "admin_withdraw_revenue") {
      const { amount, bank_detail_id } = body;

      const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      if (!isSuperAdmin) return jsonRes({ error: "Only Super Admins can withdraw revenue" }, 403);
      if (!amount || amount <= 0) return jsonRes({ error: "Invalid amount" }, 400);

      const { data: revData } = await supabase.from("platform_revenue").select("commission_amount");
      const totalRevenue = (revData || []).reduce((sum: number, r: any) => sum + (r.commission_amount || 0), 0);

      const { data: withdrawnSetting } = await supabase
        .from("platform_settings").select("value").eq("key", "total_revenue_withdrawn").maybeSingle();
      const totalWithdrawn = withdrawnSetting?.value ? Number(withdrawnSetting.value) : 0;
      const availableRevenue = totalRevenue - totalWithdrawn;

      if (amount > availableRevenue) {
        return jsonRes({ error: `Insufficient revenue. Available: ${availableRevenue}` }, 400);
      }

      const { data: bankDetail } = await supabase.from("bank_details")
        .select("*").eq("id", bank_detail_id).eq("user_id", user.id).single();

      if (!bankDetail?.recipient_code) {
        return jsonRes({ error: "Bank details not found. Please add bank details first." }, 400);
      }

      const transferRes = await fetch(`${PAYSTACK_BASE}/transfer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance", amount: amount * 100,
          recipient: bankDetail.recipient_code, reason: "Platform revenue withdrawal",
        }),
      });
      const transferData = await transferRes.json();

      if (!transferData.status) {
        return jsonRes({ error: transferData.message || "Transfer failed" }, 400);
      }

      const newWithdrawn = totalWithdrawn + amount;
      if (withdrawnSetting) {
        await supabase.from("platform_settings")
          .update({ value: newWithdrawn as any, updated_at: new Date().toISOString(), updated_by: user.id })
          .eq("key", "total_revenue_withdrawn");
      } else {
        await supabase.from("platform_settings")
          .insert({ key: "total_revenue_withdrawn", value: newWithdrawn as any, updated_by: user.id });
      }

      await supabase.from("admin_activity_log").insert({
        admin_id: user.id, action: "revenue_withdrawal", target_type: "platform_revenue",
        details: { amount, transfer_code: transferData.data?.transfer_code, bank: bankDetail.bank_name },
      });

      return jsonRes({
        success: true, transfer_code: transferData.data?.transfer_code,
        available_after: availableRevenue - amount,
      });
    }

    return jsonRes({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("Paystack transfer error:", error);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
