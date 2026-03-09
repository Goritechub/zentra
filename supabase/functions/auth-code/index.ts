import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function checkCodeStrength(code: string): { strong: boolean; reason?: string } {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return { strong: false, reason: "Code must be exactly 6 digits" };
  }
  // Reject all same digits (111111, 000000)
  if (/^(\d)\1{5}$/.test(code)) {
    return { strong: false, reason: "Code cannot be all the same digit" };
  }
  // Reject sequential ascending (123456)
  const ascending = "0123456789";
  if (ascending.includes(code)) {
    return { strong: false, reason: "Code cannot be a sequential sequence" };
  }
  // Reject sequential descending (654321)
  const descending = "9876543210";
  if (descending.includes(code)) {
    return { strong: false, reason: "Code cannot be a sequential sequence" };
  }
  // Reject repeating pairs (121212, 787878)
  if (/^(\d{2})\1{2}$/.test(code)) {
    return { strong: false, reason: "Code cannot be a repeating pair pattern" };
  }
  // Reject repeating triplets (123123)
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

      const { data: profile } = await adminClient
        .from("profiles")
        .select("auth_code_hash")
        .eq("id", user.id)
        .single();

      if (profile?.auth_code_hash) {
        return new Response(JSON.stringify({ error: "Auth code already set. Use change action." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hashed = await hashCode(code);
      await adminClient
        .from("profiles")
        .update({ auth_code_hash: hashed })
        .eq("id", user.id);

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

      const { data: profile } = await adminClient
        .from("profiles")
        .select("auth_code_hash")
        .eq("id", user.id)
        .single();

      if (!profile?.auth_code_hash) {
        return new Response(JSON.stringify({ success: false, error: "No auth code set" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hashed = await hashCode(code);
      const valid = hashed === profile.auth_code_hash;

      return new Response(JSON.stringify({ success: valid, error: valid ? null : "Invalid code" }), {
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

      const { data: profile } = await adminClient
        .from("profiles")
        .select("auth_code_hash")
        .eq("id", user.id)
        .single();

      if (!profile?.auth_code_hash) {
        return new Response(JSON.stringify({ error: "No auth code set" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const currentHashed = await hashCode(current_code);
      if (currentHashed !== profile.auth_code_hash) {
        return new Response(JSON.stringify({ error: "Current code is incorrect" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ensure new code differs from current
      const newHashed = await hashCode(new_code);
      if (newHashed === profile.auth_code_hash) {
        return new Response(JSON.stringify({ error: "New code must be different from current code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient
        .from("profiles")
        .update({ auth_code_hash: newHashed })
        .eq("id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check") {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("auth_code_hash")
        .eq("id", user.id)
        .single();

      return new Response(JSON.stringify({ has_code: !!profile?.auth_code_hash }), {
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

      const { data: profile } = await adminClient
        .from("profiles")
        .select("auth_code_hash")
        .eq("id", user.id)
        .single();

      if (!profile?.auth_code_hash) {
        return new Response(JSON.stringify({ error: "No auth code set" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hashed = await hashCode(code);
      if (hashed !== profile.auth_code_hash) {
        return new Response(JSON.stringify({ error: "Invalid current code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient
        .from("profiles")
        .update({ auth_code_hash: null })
        .eq("id", user.id);

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
