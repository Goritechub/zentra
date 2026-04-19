import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const MAX_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 30;
const RESET_TOKEN_EXPIRY_MINUTES = 15;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(code), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    KEY_LENGTH * 8
  );
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(salt.buffer)}:${toHex(derived)}`;
}

async function verifySha256(code: string, storedHash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(code));
  return toHex(digest) === storedHash;
}

async function verifyCode(code: string, storedHash: string): Promise<{ valid: boolean; isLegacy: boolean }> {
  if (storedHash.startsWith("pbkdf2:")) {
    const encoder = new TextEncoder();
    const parts = storedHash.split(":");
    if (parts.length !== 4) return { valid: false, isLegacy: false };
    const iterations = parseInt(parts[1], 10);
    const salt = fromHex(parts[2]);
    const expectedHash = parts[3];
    const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(code), "PBKDF2", false, ["deriveBits"]);
    const derived = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      keyMaterial,
      KEY_LENGTH * 8
    );
    return { valid: toHex(derived) === expectedHash, isLegacy: false };
  }
  if (/^[0-9a-f]{64}$/.test(storedHash)) {
    const valid = await verifySha256(code, storedHash);
    return { valid, isLegacy: true };
  }
  return { valid: false, isLegacy: false };
}

function checkCodeStrength(code: string): { strong: boolean; reason?: string } {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return { strong: false, reason: "Code must be exactly 6 digits" };
  }
  if (/^(\d)\1{5}$/.test(code)) {
    return { strong: false, reason: "Code cannot be all the same digit" };
  }
  const ascending = "0123456789";
  if (ascending.includes(code)) {
    return { strong: false, reason: "Code cannot be a sequential sequence" };
  }
  const descending = "9876543210";
  if (descending.includes(code)) {
    return { strong: false, reason: "Code cannot be a sequential sequence" };
  }
  if (/^(\d{2})\1{2}$/.test(code)) {
    return { strong: false, reason: "Code cannot be a repeating pair pattern" };
  }
  if (/^(\d{3})\1$/.test(code)) {
    return { strong: false, reason: "Code cannot be a repeating triplet pattern" };
  }
  return { strong: true };
}

function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, "0");
}

async function sendResetEmail(email: string, otp: string): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("EMAIL_FROM") || "ZentraGig <noreply@zentragig.com>",
      to: [email],
      subject: "Your ZentraGig Auth Code Reset",
      html: `
        <p>You requested a reset of your ZentraGig authentication code.</p>
        <p>Your one-time reset code is: <strong style="font-size:24px;letter-spacing:4px">${otp}</strong></p>
        <p>This code expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes. Do not share it with anyone.</p>
        <p>If you did not request this, you can ignore this email — your auth code remains unchanged.</p>
      `,
    }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, code, current_code, new_code, reset_token } = body;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ──────────────────────────────────────────────────────────
    // SET
    // ──────────────────────────────────────────────────────────
    if (action === "set") {
      const strength = checkCodeStrength(code);
      if (!strength.strong) {
        return new Response(JSON.stringify({ error: strength.reason }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await adminClient
        .from("auth_codes").select("user_id").eq("user_id", user.id).single();

      if (existing) {
        return new Response(JSON.stringify({ error: "Auth code already set. Use change action." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hashed = await hashCode(code);
      await adminClient.from("auth_codes").insert({ user_id: user.id, auth_code_hash: hashed });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────────────────────
    // VERIFY  (enforces 3-attempt server-side limit)
    // ──────────────────────────────────────────────────────────
    if (action === "verify") {
      if (!code || code.length !== 6) {
        return new Response(JSON.stringify({ success: false, error: "Invalid code" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authCode } = await adminClient
        .from("auth_codes")
        .select("auth_code_hash, failed_attempts, locked_until")
        .eq("user_id", user.id)
        .single();

      if (!authCode?.auth_code_hash) {
        return new Response(JSON.stringify({ success: false, error: "No auth code set" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check server-side lockout
      if (authCode.locked_until && new Date(authCode.locked_until) > new Date()) {
        const minutesLeft = Math.ceil((new Date(authCode.locked_until).getTime() - Date.now()) / 60000);
        return new Response(JSON.stringify({
          success: false,
          locked: true,
          error: `Too many failed attempts. Try again in ${minutesLeft} minute(s) or reset via email.`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const result = await verifyCode(code, authCode.auth_code_hash);

      if (!result.valid) {
        const newAttempts = (authCode.failed_attempts || 0) + 1;
        const shouldLock = newAttempts >= MAX_ATTEMPTS;
        const lockedUntil = shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
          : null;

        await adminClient.from("auth_codes").update({
          failed_attempts: newAttempts,
          ...(shouldLock ? { locked_until: lockedUntil } : {}),
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id);

        const attemptsLeft = MAX_ATTEMPTS - newAttempts;
        return new Response(JSON.stringify({
          success: false,
          locked: shouldLock,
          attempts_remaining: Math.max(0, attemptsLeft),
          error: shouldLock
            ? `Too many failed attempts. Locked for ${LOCKOUT_MINUTES} minutes. Reset via email to unlock immediately.`
            : `Invalid code. ${attemptsLeft} attempt(s) remaining.`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Success — reset attempt counter
      await adminClient.from("auth_codes").update({
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

      // Auto-migrate legacy SHA-256 hash to PBKDF2
      if (result.isLegacy) {
        const newHash = await hashCode(code);
        await adminClient.from("auth_codes").update({ auth_code_hash: newHash, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────────────────────
    // CHANGE
    // ──────────────────────────────────────────────────────────
    if (action === "change") {
      if (!current_code || current_code.length !== 6 || !/^\d{6}$/.test(current_code)) {
        return new Response(JSON.stringify({ error: "Current code is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const strength = checkCodeStrength(new_code);
      if (!strength.strong) {
        return new Response(JSON.stringify({ error: strength.reason }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authCode } = await adminClient
        .from("auth_codes")
        .select("auth_code_hash, failed_attempts, locked_until")
        .eq("user_id", user.id)
        .single();

      if (!authCode?.auth_code_hash) {
        return new Response(JSON.stringify({ error: "No auth code set" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (authCode.locked_until && new Date(authCode.locked_until) > new Date()) {
        return new Response(JSON.stringify({ error: "Account is locked. Reset via email first." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const currentResult = await verifyCode(current_code, authCode.auth_code_hash);
      if (!currentResult.valid) {
        return new Response(JSON.stringify({ error: "Current code is incorrect" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (current_code === new_code) {
        return new Response(JSON.stringify({ error: "New code must be different from current code" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newHashed = await hashCode(new_code);
      await adminClient.from("auth_codes").update({
        auth_code_hash: newHashed,
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────────────────────
    // REQUEST RESET — sends OTP to user's email
    // ──────────────────────────────────────────────────────────
    if (action === "request_reset") {
      const { data: authCode } = await adminClient
        .from("auth_codes").select("user_id").eq("user_id", user.id).single();

      if (!authCode) {
        return new Response(JSON.stringify({ error: "No auth code found for this account" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const otp = generateOtp();
      const otpHash = await hashCode(otp);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();

      await adminClient.from("auth_codes").update({
        reset_token_hash: otpHash,
        reset_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

      const emailSent = await sendResetEmail(user.email!, otp);

      return new Response(JSON.stringify({
        success: true,
        email_sent: emailSent,
        // In dev (no RESEND_API_KEY), surface OTP for testing only
        ...(Deno.env.get("NODE_ENV") === "development" && !emailSent ? { dev_otp: otp } : {}),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ──────────────────────────────────────────────────────────
    // CONFIRM RESET — verify OTP and set new code
    // ──────────────────────────────────────────────────────────
    if (action === "confirm_reset") {
      if (!reset_token || reset_token.length !== 6) {
        return new Response(JSON.stringify({ error: "Invalid reset token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const strength = checkCodeStrength(new_code);
      if (!strength.strong) {
        return new Response(JSON.stringify({ error: strength.reason }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authCode } = await adminClient
        .from("auth_codes")
        .select("reset_token_hash, reset_token_expires_at")
        .eq("user_id", user.id)
        .single();

      if (!authCode?.reset_token_hash) {
        return new Response(JSON.stringify({ error: "No reset token requested" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!authCode.reset_token_expires_at || new Date(authCode.reset_token_expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Reset token has expired. Request a new one." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenResult = await verifyCode(reset_token, authCode.reset_token_hash);
      if (!tokenResult.valid) {
        return new Response(JSON.stringify({ error: "Invalid reset token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newHashed = await hashCode(new_code);
      await adminClient.from("auth_codes").update({
        auth_code_hash: newHashed,
        failed_attempts: 0,
        locked_until: null,
        reset_token_hash: null,
        reset_token_expires_at: null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────────────────────
    // CHECK
    // ──────────────────────────────────────────────────────────
    if (action === "check") {
      const { data: authCode } = await adminClient
        .from("auth_codes")
        .select("user_id, locked_until, failed_attempts")
        .eq("user_id", user.id)
        .single();

      return new Response(JSON.stringify({
        has_code: !!authCode,
        locked: !!(authCode?.locked_until && new Date(authCode.locked_until) > new Date()),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ──────────────────────────────────────────────────────────
    // CHECK_STRENGTH / RESET (legacy — delete old code)
    // ──────────────────────────────────────────────────────────
    if (action === "check_strength") {
      const strength = checkCodeStrength(code);
      return new Response(JSON.stringify(strength), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset") {
      if (!code || code.length !== 6) {
        return new Response(JSON.stringify({ error: "Current code required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authCode } = await adminClient
        .from("auth_codes").select("auth_code_hash").eq("user_id", user.id).single();

      if (!authCode?.auth_code_hash) {
        return new Response(JSON.stringify({ error: "No auth code set" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resetResult = await verifyCode(code, authCode.auth_code_hash);
      if (!resetResult.valid) {
        return new Response(JSON.stringify({ error: "Invalid current code" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("auth_codes").delete().eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
