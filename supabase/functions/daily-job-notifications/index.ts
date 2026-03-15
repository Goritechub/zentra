import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get jobs posted in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentJobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, title, description, required_skills, required_software, budget_min, budget_max, is_remote, state, city, delivery_days")
      .eq("status", "open")
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: false });

    if (jobsError) throw jobsError;
    if (!recentJobs?.length) {
      return new Response(JSON.stringify({ message: "No new jobs to notify about" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all freelancer profiles with their skills
    const { data: freelancers, error: flError } = await supabase
      .from("freelancer_profiles")
      .select("user_id, skills, title");

    if (flError) throw flError;
    if (!freelancers?.length) {
      return new Response(JSON.stringify({ message: "No freelancers to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profile emails
    const userIds = freelancers.map((f: any) => f.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    let notificationsSent = 0;

    for (const freelancer of freelancers) {
      const freelancerSkills = (freelancer.skills || []).map((s: string) => s.toLowerCase());
      if (freelancerSkills.length === 0) continue;

      // Find matching jobs based on skill overlap
      const matchingJobs = recentJobs.filter((job: any) => {
        const jobSkills = [...(job.required_skills || []), ...(job.required_software || [])].map((s: string) => s.toLowerCase());
        return jobSkills.some((js: string) => freelancerSkills.some((fs: string) => js.includes(fs) || fs.includes(js)));
      });

      if (matchingJobs.length === 0) continue;

      const profile = profileMap.get(freelancer.user_id);
      if (!profile?.email) continue;

      const jobListText = matchingJobs.slice(0, 5).map((j: any, i: number) =>
        `${i + 1}. ${j.title} - Budget: ${j.budget_min ? `NGN ${j.budget_min.toLocaleString()}` : "Negotiable"}${j.budget_max ? ` - NGN ${j.budget_max.toLocaleString()}` : ""} | ${j.is_remote ? "Remote" : (j.state || "Global")}${j.delivery_days ? ` | ${j.delivery_days} days` : ""}`
      ).join("\n");

      let emailBody = "";
      if (openAiApiKey) {
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            temperature: 0.4,
            max_tokens: 300,
            messages: [
              {
                role: "system",
                content: "You write short, professional email bodies for a CAD engineering freelance marketplace called CADNaija. Keep it under 150 words. Be friendly and action-oriented. Do not include a subject line."
              },
              {
                role: "user",
                content: `Write an email body for ${profile.full_name || "Expert"} (a ${freelancer.title || "CAD professional"}) about these new matching jobs:\n\n${jobListText}\n\nInclude a call to action to visit the platform to apply.`
              }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          emailBody = aiData.choices?.[0]?.message?.content?.trim() || "";
        } else {
          console.error("[daily-job-notifications] OpenAI request failed:", await aiResponse.text());
        }
      }

      if (!emailBody) {
        emailBody = `Hi ${profile.full_name || "Expert"},\n\nWe found ${matchingJobs.length} new job(s) matching your skills:\n\n${jobListText}\n\nVisit CADNaija to apply now!\n\nBest regards,\nCADNaija Team`;
      }

      // Send email via Supabase Auth admin (using the built-in email service)
      // For now, we log the notification. In production, integrate with an email service.
      console.log(`[JOB MATCH] Email to ${profile.email}: ${matchingJobs.length} matching jobs`);
      console.log(`Email body preview: ${emailBody.substring(0, 200)}...`);

      notificationsSent++;
    }

    return new Response(
      JSON.stringify({ message: `Processed ${notificationsSent} job match notifications`, jobCount: recentJobs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in daily-job-notifications:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
