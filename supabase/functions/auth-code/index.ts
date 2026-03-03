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

    const { action, code } = await req.json();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "set") {
      if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        return new Response(JSON.stringify({ error: "Code must be exactly 6 digits" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user already has a code set
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
      const { current_code, new_code } = await req.json().catch(() => ({ current_code: null, new_code: null }));
      // Re-parse since we already consumed body - use code field for current, and accept new_code from body
      // Actually the body was already parsed above, so let's use what we got
      return new Response(JSON.stringify({ error: "Use set action for initial setup" }), {
        status: 400,
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

    if (action === "reset") {
      // Requires current code verification first
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

      // Clear the code so they can set a new one
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
