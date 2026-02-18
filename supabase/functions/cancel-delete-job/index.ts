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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch the job and verify ownership
    const { data: job, error: jobError } = await adminClient
      .from("jobs")
      .select("id, title, client_id, status")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.client_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for active contracts
    const { data: activeContracts } = await adminClient
      .from("contracts")
      .select("id")
      .eq("job_id", job_id)
      .eq("status", "active")
      .limit(1);

    if (activeContracts && activeContracts.length > 0) {
      return new Response(
        JSON.stringify({ error: "Cannot delete a job with an active contract. Open a dispute instead." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all proposals with freelancer info
    const { data: proposals } = await adminClient
      .from("proposals")
      .select("id, freelancer_id")
      .eq("job_id", job_id);

    const freelancerIds = proposals?.map((p) => p.freelancer_id) || [];

    // Send notification messages to each applicant
    const notificationContent = `📋 Job Update: The job "${job.title}" has been cancelled and closed by the client. No further action is needed on your part.`;

    for (const freelancerId of freelancerIds) {
      await adminClient.from("messages").insert({
        sender_id: user.id,
        receiver_id: freelancerId,
        content: notificationContent,
        is_read: false,
      });
    }

    // Update all proposals to rejected
    if (proposals && proposals.length > 0) {
      await adminClient
        .from("proposals")
        .update({ status: "rejected" })
        .eq("job_id", job_id);
    }

    // Set job_id to null on contracts to avoid FK issues
    await adminClient.from("contracts").update({ job_id: null }).eq("job_id", job_id);

    // Delete or update offers linked to this job
    await adminClient.from("offers").update({ job_id: null }).eq("job_id", job_id);

    // Delete the job (proposals cascade automatically)
    const { error: deleteError } = await adminClient
      .from("jobs")
      .delete()
      .eq("id", job_id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete job: " + deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, notified: freelancerIds.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
