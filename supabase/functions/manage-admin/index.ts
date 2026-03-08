import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALL_PERMISSIONS = [
  "users", "jobs", "contests", "contracts", "payments",
  "disputes", "reviews", "platform_settings", "activity_log", "admin_management",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !caller) throw new Error("Invalid token");

    // Verify caller is admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) throw new Error("Not an admin");

    const { action, ...params } = await req.json();

    switch (action) {
      case "bootstrap": {
        const { count } = await supabaseAdmin
          .from("admin_permissions")
          .select("id", { count: "exact", head: true });

        if ((count || 0) > 0) {
          throw new Error("Admin permissions already configured. Bootstrap not needed.");
        }

        const permRows = ALL_PERMISSIONS.map((p) => ({
          user_id: caller.id,
          permission: p,
          granted_by: caller.id,
        }));

        await supabaseAdmin.from("admin_permissions").insert(permRows);

        await supabaseAdmin.from("admin_activity_log").insert({
          admin_id: caller.id,
          action: "bootstrap_super_admin",
          target_type: "system",
          details: { permissions: ALL_PERMISSIONS },
        });

        return new Response(
          JSON.stringify({ success: true, permissions: ALL_PERMISSIONS }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "list_admins": {
        const { data: adminRoles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        const adminIds = adminRoles?.map((r: any) => r.user_id) || [];

        if (adminIds.length === 0) {
          return new Response(
            JSON.stringify({ admins: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, email, full_name, avatar_url, created_at")
          .in("id", adminIds);

        const { data: permissions } = await supabaseAdmin
          .from("admin_permissions")
          .select("user_id, permission")
          .in("user_id", adminIds);

        const admins = profiles?.map((p: any) => ({
          ...p,
          permissions: permissions
            ?.filter((perm: any) => perm.user_id === p.id)
            .map((perm: any) => perm.permission) || [],
          is_current_user: p.id === caller.id,
        })) || [];

        return new Response(
          JSON.stringify({ admins }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "create_admin": {
        // Verify super admin permission
        const { data: hasPerm } = await supabaseAdmin
          .from("admin_permissions")
          .select("id")
          .eq("user_id", caller.id)
          .eq("permission", "admin_management")
          .maybeSingle();

        if (!hasPerm) throw new Error("No admin_management permission");

        const { email, password, fullName, permissions } = params;
        if (!email || !password || !fullName) throw new Error("Missing required fields");

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, role: "admin" },
        });

        if (createError) throw createError;

        // Add admin role
        await supabaseAdmin.from("user_roles").insert({
          user_id: newUser.user.id,
          role: "admin",
        });

        // Add permissions
        if (permissions?.length > 0) {
          const permRows = permissions.map((p: string) => ({
            user_id: newUser.user.id,
            permission: p,
            granted_by: caller.id,
          }));
          await supabaseAdmin.from("admin_permissions").insert(permRows);
        }

        await supabaseAdmin.from("admin_activity_log").insert({
          admin_id: caller.id,
          action: "create_admin",
          target_type: "user",
          target_id: newUser.user.id,
          details: { email, fullName, permissions },
        });

        return new Response(
          JSON.stringify({ success: true, userId: newUser.user.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "update_permissions": {
        const { data: hasPerm } = await supabaseAdmin
          .from("admin_permissions")
          .select("id")
          .eq("user_id", caller.id)
          .eq("permission", "admin_management")
          .maybeSingle();

        if (!hasPerm) throw new Error("No admin_management permission");

        const { targetUserId, permissions } = params;
        if (!targetUserId) throw new Error("Missing target user");
        if (targetUserId === caller.id) throw new Error("Cannot modify own permissions");

        // Delete existing
        await supabaseAdmin
          .from("admin_permissions")
          .delete()
          .eq("user_id", targetUserId);

        // Insert new
        if (permissions?.length > 0) {
          const permRows = permissions.map((p: string) => ({
            user_id: targetUserId,
            permission: p,
            granted_by: caller.id,
          }));
          await supabaseAdmin.from("admin_permissions").insert(permRows);
        }

        await supabaseAdmin.from("admin_activity_log").insert({
          admin_id: caller.id,
          action: "update_admin_permissions",
          target_type: "user",
          target_id: targetUserId,
          details: { permissions },
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "remove_admin": {
        const { data: hasPerm } = await supabaseAdmin
          .from("admin_permissions")
          .select("id")
          .eq("user_id", caller.id)
          .eq("permission", "admin_management")
          .maybeSingle();

        if (!hasPerm) throw new Error("No admin_management permission");

        const { targetUserId } = params;
        if (!targetUserId) throw new Error("Missing target user");
        if (targetUserId === caller.id) throw new Error("Cannot remove yourself");

        await supabaseAdmin.from("admin_permissions").delete().eq("user_id", targetUserId);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUserId).eq("role", "admin");
        await supabaseAdmin.from("profiles").update({ role: "client" }).eq("id", targetUserId);

        await supabaseAdmin.from("admin_activity_log").insert({
          admin_id: caller.id,
          action: "remove_admin",
          target_type: "user",
          target_id: targetUserId,
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
