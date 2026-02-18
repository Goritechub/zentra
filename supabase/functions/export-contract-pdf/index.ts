import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const contractId = url.searchParams.get("contract_id");
    if (!contractId) return new Response(JSON.stringify({ error: "contract_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader! } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Fetch all contract data
    const [contractRes, milestonesRes, messagesRes, disputesRes, attachmentsRes] = await Promise.all([
      adminClient.from("contracts").select("*, client:profiles!contracts_client_id_fkey(full_name, email), freelancer:profiles!contracts_freelancer_id_fkey(full_name, email)").eq("id", contractId).single(),
      adminClient.from("milestones").select("*").eq("contract_id", contractId).order("created_at"),
      adminClient.from("contract_messages").select("*").eq("contract_id", contractId).order("created_at"),
      adminClient.from("disputes").select("*").eq("contract_id", contractId).order("created_at"),
      adminClient.from("contract_attachments").select("*").eq("contract_id", contractId).order("created_at"),
    ]);

    const contract = contractRes.data;
    if (!contract) return new Response(JSON.stringify({ error: "Contract not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const milestones = milestonesRes.data || [];
    const messages = messagesRes.data || [];
    const disputes = disputesRes.data || [];
    const attachments = attachmentsRes.data || [];

    // Fetch sender profiles for messages
    const senderIds = [...new Set(messages.map((m: any) => m.sender_id))];
    const { data: profiles } = await adminClient.from("profiles").select("id, full_name").in("id", senderIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));

    const formatAmount = (amount: number) => `₦${(amount || 0).toLocaleString()}`;
    const formatDate = (d: string | null) => d ? new Date(d).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—";

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Contract Report - ${contract.job_title || contract.id}</title>
<style>
body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;font-size:13px;color:#333}
h1{font-size:20px;border-bottom:2px solid #2563eb;padding-bottom:8px}
h2{font-size:16px;margin-top:24px;color:#2563eb}
table{width:100%;border-collapse:collapse;margin:8px 0}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:12px}
th{background:#f3f4f6}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#e5e7eb}
.msg{margin:6px 0;padding:8px;border-left:3px solid #ddd;background:#fafafa}
.msg.system{border-left-color:#f59e0b;background:#fffbeb}
.meta{color:#666;font-size:11px}
@media print{body{font-size:11px}h1{font-size:16px}h2{font-size:14px}}
</style></head><body>
<h1>Contract Report</h1>
<table>
<tr><th>Contract ID</th><td>${contract.id}</td></tr>
<tr><th>Status</th><td><span class="badge">${contract.status}</span></td></tr>
<tr><th>Client</th><td>${contract.client?.full_name} (${contract.client?.email})</td></tr>
<tr><th>Expert</th><td>${contract.freelancer?.full_name} (${contract.freelancer?.email})</td></tr>
<tr><th>Amount</th><td>${formatAmount(contract.amount)}</td></tr>
<tr><th>Created</th><td>${formatDate(contract.created_at)}</td></tr>
<tr><th>Started</th><td>${formatDate(contract.started_at)}</td></tr>
${contract.completed_at ? `<tr><th>Completed</th><td>${formatDate(contract.completed_at)}</td></tr>` : ""}
</table>

${contract.job_description ? `<h2>Job Details</h2>
<p><strong>${contract.job_title || ""}</strong></p>
<p>${contract.job_description}</p>
${contract.job_category ? `<p>Category: ${contract.job_category}</p>` : ""}
${contract.job_budget_min || contract.job_budget_max ? `<p>Budget: ${formatAmount(contract.job_budget_min)} – ${formatAmount(contract.job_budget_max)}</p>` : ""}` : ""}

${contract.accepted_cover_letter ? `<h2>Accepted Proposal</h2>
<p>${contract.accepted_cover_letter}</p>
<p>Bid: ${formatAmount(contract.accepted_bid_amount || contract.amount)} | Payment: ${contract.accepted_payment_type || "project"}</p>` : ""}

<h2>Milestones (${milestones.length})</h2>
${milestones.length ? `<table><tr><th>Title</th><th>Amount</th><th>Status</th><th>Funded</th><th>Submitted</th><th>Approved</th></tr>
${milestones.map((m: any) => `<tr><td>${m.title}</td><td>${formatAmount(m.amount)}</td><td><span class="badge">${m.status}</span></td><td>${formatDate(m.funded_at)}</td><td>${formatDate(m.submitted_at)}</td><td>${formatDate(m.approved_at)}</td></tr>`).join("")}
</table>` : "<p>No milestones</p>"}

<h2>Message History (${messages.length})</h2>
${messages.map((m: any) => `<div class="msg${m.is_system_message ? " system" : ""}">
<span class="meta">${profileMap.get(m.sender_id) || (m.is_system_message ? "System" : m.sender_id)} — ${formatDate(m.created_at)}</span>
<p>${m.content}</p></div>`).join("")}

<h2>Attachments (${attachments.length})</h2>
${attachments.length ? `<table><tr><th>File</th><th>Context</th><th>Uploaded</th><th>URL</th></tr>
${attachments.map((a: any) => `<tr><td>${a.file_name}</td><td>${a.context}</td><td>${formatDate(a.created_at)}</td><td><a href="${a.file_url}">Download</a></td></tr>`).join("")}
</table>` : "<p>No attachments</p>"}

${disputes.length ? `<h2>Disputes (${disputes.length})</h2>
${disputes.map((d: any) => `<div class="msg" style="border-left-color:#ef4444">
<span class="meta">Status: ${d.status} — ${formatDate(d.created_at)}</span>
<p><strong>Reason:</strong> ${d.reason}</p>
${d.admin_notes ? `<p><strong>Admin:</strong> ${d.admin_notes}</p>` : ""}
${d.evidence_urls?.length ? `<p>Evidence: ${d.evidence_urls.map((_: any, i: number) => `<a href="${d.evidence_urls[i]}">File ${i+1}</a>`).join(", ")}</p>` : ""}
</div>`).join("")}` : ""}

<hr><p class="meta">Generated on ${new Date().toLocaleString("en-NG")}</p>
</body></html>`;

    return new Response(html, { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
