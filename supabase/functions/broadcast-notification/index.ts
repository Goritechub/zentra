import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is a super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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

    // Check super admin
    const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", { _user_id: user.id });
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Only Super Admins can broadcast notifications" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { title, message, type = "platform_announcement", link_url } = body;

    if (!title || !message) {
      return new Response(JSON.stringify({ error: "Title and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all user IDs from profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email");

    if (profilesError) {
      throw new Error(`Failed to fetch users: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ error: "No users found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch insert notifications (in chunks of 500 to avoid payload limits)
    const CHUNK_SIZE = 500;
    let totalInserted = 0;

    for (let i = 0; i < profiles.length; i += CHUNK_SIZE) {
      const chunk = profiles.slice(i, i + CHUNK_SIZE);
      const notifications = chunk.map((p: any) => ({
        user_id: p.id,
        title,
        message,
        type,
        link_url: link_url || null,
        is_read: false,
      }));

      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (insertError) {
        console.error(`Chunk insert error at offset ${i}:`, insertError);
      } else {
        totalInserted += chunk.length;
      }
    }

    // Log admin activity
    await supabase.from("admin_activity_log").insert({
      admin_id: user.id,
      action: "broadcast_notification",
      target_type: "platform",
      target_id: null,
      details: {
        title,
        message: message.substring(0, 200),
        type,
        recipients_count: totalInserted,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        recipients: totalInserted,
        total_users: profiles.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Broadcast notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
