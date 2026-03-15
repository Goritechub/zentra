import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Same regex patterns as moderate-message
const PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
  emailProvider: /\b(?:gmail|yahoo|outlook|hotmail|protonmail|ymail|aol|icloud|zoho|mail\.com)\b/i,
  phone: /(?:\+?234|0)?[789][01]\d{8}|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{10,11}\b/,
  spacedDigits: /\b\d[\s.-]\d[\s.-]\d[\s.-]\d[\s.-]\d[\s.-]?\d[\s.-]?\d/,
  writtenNumbers: /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\s+(?:zero|one|two|three|four|five|six|seven|eight|nine)\s+(?:zero|one|two|three|four|five|six|seven|eight|nine)/i,
  suspiciousDigits: /\b\d{7,}\b/,
  whatsapp: /whatsapp|whats\s*app|wa\.me|chat\s*me\s*on/i,
  socialMedia: /\b(?:instagram|ig|insta|facebook|fb|twitter|x\.com|tiktok|snapchat|telegram|linkedin|signal)\b/i,
  url: /https?:\/\/[^\s]+|www\.[^\s]+/i,
  scam: /\b(?:send money|wire transfer|western union|moneygram|bitcoin wallet|crypto wallet)\b/i,
  profanity: /\b(?:fuck|shit|bitch|ass(?:hole)?|damn|bastard|dick|cunt|idiot|stupid|dumb(?:ass)?)\b/i,
  obfuscatedEmail: /\bat\s+(?:gmail|yahoo|outlook|hotmail)\s+dot\s+com\b/i,
  offPlatformIntent: /\b(?:message me on\s+(?:whatsapp|telegram|signal|instagram|facebook)|dm me on\s+\w+|reach me (?:on|at)\s+(?:whatsapp|telegram|signal|instagram|facebook|my\s+(?:phone|number|email)))\b/i,
};

function regexModerate(content: string): { allowed: boolean; reason: string; confidence: number } {
  const normalized = content.replace(/[\u200B-\u200D\uFEFF]/g, "");
  const checks: [RegExp, string][] = [
    [PATTERNS.email, "Email addresses are not allowed in proposals"],
    [PATTERNS.emailProvider, "References to email services are not allowed"],
    [PATTERNS.obfuscatedEmail, "Obfuscated email patterns detected"],
    [PATTERNS.phone, "Phone numbers are not allowed in proposals"],
    [PATTERNS.spacedDigits, "Spaced digit sequences detected"],
    [PATTERNS.writtenNumbers, "Written-out number sequences detected"],
    [PATTERNS.suspiciousDigits, "Long number sequences are not allowed"],
    [PATTERNS.whatsapp, "WhatsApp references are not allowed"],
    [PATTERNS.socialMedia, "Social media handles are not allowed"],
    [PATTERNS.url, "External links are not allowed in proposals"],
    [PATTERNS.scam, "Potential scam content detected"],
    [PATTERNS.profanity, "Profanity is not allowed"],
    [PATTERNS.offPlatformIntent, "Off-platform contact intent detected"],
  ];

  for (const [pattern, reason] of checks) {
    if (pattern.test(normalized)) {
      return { allowed: false, reason, confidence: 0.95 };
    }
  }
  return { allowed: true, reason: "", confidence: 1.0 };
}

async function aiModerate(content: string): Promise<{ allowed: boolean; reason: string; confidence: number } | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You are a content moderator for a freelance marketplace proposal/cover letter. ONLY block content that contains EXPLICIT contact details (real phone numbers, email addresses, social media handles/usernames) or CLEAR attempts to move communication off-platform (e.g. "message me on WhatsApp", "here's my number").

DO NOT block:
- Professional language like "call it done", "call this project", "contact you through the platform"
- Generic words like "call", "reach", "contact" used in normal professional context
- Discussion of project scope, timelines, deliverables
- Technical descriptions or professional qualifications

Only flag with high confidence (0.95+) when there is an UNMISTAKABLE attempt to share real contact info.
Respond ONLY with JSON: {"allowed":boolean,"reason":"string","confidence":number}`,
          },
          { role: "user", content },
        ],
        response_format: {
          type: "json_object",
        },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check suspension
    const { data: violations } = await supabaseAdmin
      .from("user_violation_counts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (violations?.is_suspended) {
      return new Response(
        JSON.stringify({ error: "Your account is suspended." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { job_id, bid_amount, delivery_days, cover_letter, attachments, payment_type, milestones, delivery_unit } = await req.json();

    if (!job_id || !bid_amount || !delivery_days || !cover_letter?.trim()) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check duplicate application
    const { data: existingProposal } = await supabaseAdmin
      .from("proposals")
      .select("id")
      .eq("job_id", job_id)
      .eq("freelancer_id", user.id)
      .maybeSingle();

    if (existingProposal) {
      return new Response(
        JSON.stringify({ error: "You have already applied to this job." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check job is still open
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("status")
      .eq("id", job_id)
      .single();

    if (!job || job.status !== "open") {
      return new Response(
        JSON.stringify({ error: "This job is no longer accepting proposals." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Layer A: Regex moderation on cover letter
    const regexResult = regexModerate(cover_letter);
    if (!regexResult.allowed) {
      await supabaseAdmin.from("moderation_logs").insert({
        user_id: user.id,
        content_type: "proposal",
        raw_content: cover_letter.substring(0, 2000),
        violation_reason: regexResult.reason,
        confidence: regexResult.confidence,
      });
      return new Response(
        JSON.stringify({ error: `Proposal blocked: ${regexResult.reason}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Layer B: AI moderation
    const aiResult = await aiModerate(cover_letter);
    if (aiResult && !aiResult.allowed && aiResult.confidence > 0.9) {
      await supabaseAdmin.from("moderation_logs").insert({
        user_id: user.id,
        content_type: "proposal",
        raw_content: cover_letter.substring(0, 2000),
        violation_reason: aiResult.reason,
        confidence: aiResult.confidence,
      });
      return new Response(
        JSON.stringify({ error: `Proposal blocked: ${aiResult.reason}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert proposal
    const { data: proposal, error: insertError } = await supabaseAdmin
      .from("proposals")
      .insert({
        job_id,
        freelancer_id: user.id,
        bid_amount: parseInt(bid_amount),
        delivery_days: parseInt(delivery_days),
        cover_letter: cover_letter.trim(),
        payment_type: payment_type || 'project',
        milestones: milestones || [],
        delivery_unit: delivery_unit || 'days',
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to submit proposal" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, proposal }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Server error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
