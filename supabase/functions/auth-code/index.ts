import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

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
  // PBKDF2 format
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
  // Legacy SHA-256 format (64-char hex)
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
    const { action, code, current_code, new_code } = body;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "set") {
      const strength = checkCodeStrength(code);
      if (!strength.strong) {
        return new Response(JSON.stringify({ error: strength.reason }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await adminClient
        .from("auth_codes")
        .select("user_id")
        .eq("user_id", user.id)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ error: "Auth code already set. Use change action." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hashed = await hashCode(code);
      await adminClient
        .from("auth_codes")
        .insert({ user_id: user.id, auth_code_hash: hashed });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      if (!code || code.length !== 6) {
        return new Response(JSON.stringify({ success: false, error: "Invalid code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authCode } = await adminClient
        .from("auth_codes")
        .select("auth_code_hash")
        .eq("user_id", user.id)
        .single();

      if (!authCode?.auth_code_hash) {
        return new Response(JSON.stringify({ success: false, error: "No auth code set" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await verifyCode(code, authCode.auth_code_hash);

      // Auto-migrate legacy SHA-256 hash to PBKDF2
      if (result.valid && result.isLegacy) {
        const newHash = await hashCode(code);
        await adminClient.from("auth_codes").update({ auth_code_hash: newHash, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      }

      return new Response(JSON.stringify({ success: result.valid, error: result.valid ? null : "Invalid code" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "change") {
      if (!current_code || current_code.length !== 6 || !/^\d{6}$/.test(current_code)) {
        return new Response(JSON.stringify({ error: "Current code is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const strength = checkCodeStrength(new_code);
      if (!strength.strong) {
        return new Response(JSON.stringify({ error: strength.reason }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authCode } = await adminClient
        .from("auth_codes")
        .select("auth_code_hash")
        .eq("user_id", user.id)
        .single();

      if (!authCode?.auth_code_hash) {
        return new Response(JSON.stringify({ error: "No auth code set" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const currentResult = await verifyCode(current_code, authCode.auth_code_hash);
      if (!currentResult.valid) {
        return new Response(JSON.stringify({ error: "Current code is incorrect" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ensure new code is different (compare plaintext since bcrypt hashes differ each time)
      if (current_code === new_code) {
        return new Response(JSON.stringify({ error: "New code must be different from current code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newHashed = await hashCode(new_code);

      await adminClient
        .from("auth_codes")
        .update({ auth_code_hash: newHashed, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check") {
      const { data: authCode } = await adminClient
        .from("auth_codes")
        .select("user_id")
        .eq("user_id", user.id)
        .single();

      return new Response(JSON.stringify({ has_code: !!authCode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_strength") {
      const strength = checkCodeStrength(code);
      return new Response(JSON.stringify(strength), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset") {
      if (!code || code.length !== 6) {
        return new Response(JSON.stringify({ error: "Current code required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authCode } = await adminClient
        .from("auth_codes")
        .select("auth_code_hash")
        .eq("user_id", user.id)
        .single();

      if (!authCode?.auth_code_hash) {
        return new Response(JSON.stringify({ error: "No auth code set" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const valid = await verifyCode(code, authCode.auth_code_hash);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid current code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient
        .from("auth_codes")
        .delete()
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
