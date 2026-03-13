import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Regex Layer (fast) ───────────────────────────────────────────────
const PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
  emailProvider: /\b(?:gmail|yahoo|outlook|hotmail|protonmail|ymail|aol|icloud|zoho|mail\.com)\b/i,
  phone: /(?:\+?234|0)?[789][01]\d{8}|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{10,11}\b/,
  spacedDigits: /\b\d[\s.-]\d[\s.-]\d[\s.-]\d[\s.-]\d[\s.-]?\d[\s.-]?\d/,
  writtenNumbers: /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\s+(?:zero|one|two|three|four|five|six|seven|eight|nine)\s+(?:zero|one|two|three|four|five|six|seven|eight|nine)/i,
  suspiciousDigits: /\b\d{7,}\b/,
  bankAccount: /\b\d{10}\b|(?:account\s*(?:number|no|#|num))\s*:?\s*\d+/i,
  whatsapp: /whatsapp|whats\s*app|wa\.me|chat\s*me\s*on/i,
  socialMedia: /\b(?:instagram|ig|insta|facebook|fb|twitter|x\.com|tiktok|snapchat|telegram|linkedin|signal)\b/i,
  url: /https?:\/\/[^\s]+|www\.[^\s]+/i,
  scam: /\b(?:send money|wire transfer|western union|moneygram|bitcoin wallet|crypto wallet|sort code|routing number)\b/i,
  profanity: /\b(?:fuck|shit|bitch|ass(?:hole)?|damn|bastard|dick|cunt|idiot|stupid|dumb(?:ass)?)\b/i,
  obfuscatedEmail: /\bat\s+(?:gmail|yahoo|outlook|hotmail)\s+dot\s+com\b/i,
  symbolAbuse: /@@|\.\.(?:com|net|org)/i,
  offPlatformIntent: /\b(?:message me on whatsapp|call me on|send me email at|dm me on instagram|reach me at my|text me on|hit me up on telegram)\b/i,
};

interface ModerationResult {
  allowed: boolean;
  reason: string;
  confidence: number;
  violations: string[];
}

function regexModerate(content: string): ModerationResult {
  const violations: string[] = [];
  const normalized = content.replace(/[\u200B-\u200D\uFEFF]/g, "");

  const checks: [RegExp, string][] = [
    [PATTERNS.email, "Email addresses are not allowed"],
    [PATTERNS.emailProvider, "References to email services are not allowed"],
    [PATTERNS.obfuscatedEmail, "Obfuscated email patterns detected"],
    [PATTERNS.phone, "Phone numbers are not allowed"],
    [PATTERNS.spacedDigits, "Spaced digit sequences are not allowed"],
    [PATTERNS.writtenNumbers, "Written-out number sequences are not allowed"],
    [PATTERNS.suspiciousDigits, "Long number sequences are not allowed"],
    [PATTERNS.bankAccount, "Bank account details are not allowed"],
    [PATTERNS.whatsapp, "WhatsApp references are not allowed"],
    [PATTERNS.socialMedia, "Social media handles are not allowed"],
    [PATTERNS.url, "External links are not allowed"],
    [PATTERNS.scam, "Potential scam content detected"],
    [PATTERNS.profanity, "Profanity is not allowed"],
    [PATTERNS.symbolAbuse, "Symbol obfuscation detected"],
    [PATTERNS.offPlatformIntent, "Off-platform contact intent detected"],
  ];

  for (const [pattern, reason] of checks) {
    if (pattern.test(normalized)) {
      violations.push(reason);
    }
  }

  if (violations.length > 0) {
    return {
      allowed: false,
      reason: violations[0],
      confidence: 0.95,
      violations,
    };
  }
  return { allowed: true, reason: "", confidence: 1.0, violations: [] };
}

// ── AI Layer ─────────────────────────────────────────────────────────
async function aiModerate(content: string): Promise<ModerationResult | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You are a content moderator for a freelance marketplace. Your job is to detect CLEAR and EXPLICIT attempts to share private contact information or move communication off-platform.

BLOCK only when the message contains:
- Actual phone numbers or digit sequences that are clearly phone/account numbers
- Actual email addresses or obvious obfuscations (e.g. "john at gmail dot com")
- Actual social media handles with usernames (e.g. "@john on instagram")
- Actual URLs or links to external sites
- Actual bank account or financial transfer details

DO NOT BLOCK:
- General discussion about work, projects, timelines, deliverables
- Words like "call", "contact", "reach", "message" used in normal professional context (e.g. "I'll call it done", "feel free to message me here", "let me reach the deadline")
- Mentions of platforms in general discussion (e.g. "I saw on LinkedIn that..." is fine, "@john_doe on linkedin" is not)
- Normal business negotiations about price, timeline, scope

Be lenient. Only block when you are highly confident (>0.9) that the user is actually trying to share private contact info or move off-platform. When in doubt, allow the message.

Respond ONLY with JSON: {"allowed":boolean,"reason":"string","confidence":number}
If clean, return {"allowed":true,"reason":"","confidence":1.0}`,
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
  } catch (e) {
    console.error("AI moderation error:", e);
    return null;
  }
}

// ── Escalation logic ─────────────────────────────────────────────────
async function recordViolation(
  supabase: any,
  userId: string,
  contentType: string,
  rawContent: string,
  reason: string,
  confidence: number
) {
  // Log the violation
  await supabase.from("moderation_logs").insert({
    user_id: userId,
    content_type: contentType,
    raw_content: rawContent.substring(0, 2000),
    violation_reason: reason,
    confidence,
  });

  // Upsert violation count
  const { data: existing } = await supabase
    .from("user_violation_counts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const newCount = existing.total_violations + 1;
    const update: any = {
      total_violations: newCount,
      last_violation_at: new Date().toISOString(),
    };

    if (newCount >= 3) {
      update.is_suspended = true;
    } else if (newCount >= 2) {
      const restrictUntil = new Date();
      restrictUntil.setHours(restrictUntil.getHours() + 24);
      update.messaging_restricted_until = restrictUntil.toISOString();
    }

    await supabase.from("user_violation_counts").update(update).eq("user_id", userId);
  } else {
    await supabase.from("user_violation_counts").insert({
      user_id: userId,
      total_violations: 1,
      last_violation_at: new Date().toISOString(),
    });
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
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
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

    // Check if user is suspended or restricted
    const { data: violations } = await supabaseAdmin
      .from("user_violation_counts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (violations?.is_suspended) {
      return new Response(
        JSON.stringify({ error: "Your account is suspended. Contact support for assistance." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (violations?.messaging_restricted_until) {
      const restrictedUntil = new Date(violations.messaging_restricted_until);
      if (restrictedUntil > new Date()) {
        return new Response(
          JSON.stringify({ error: "Messaging is temporarily restricted due to policy violations. Try again later." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { receiver_id, content, attachments } = await req.json();
    if (!receiver_id || !content) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Layer A: Regex
    const regexResult = regexModerate(content);
    if (!regexResult.allowed) {
      await recordViolation(supabaseAdmin, user.id, "message", content, regexResult.reason, regexResult.confidence);
      return new Response(
        JSON.stringify({
          error: "Message blocked",
          message: "For your safety, sharing personal contact information or social media handles is not allowed. Please keep all communication on the platform.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Layer B: AI (non-blocking fallback)
    const aiResult = await aiModerate(content);
    if (aiResult && !aiResult.allowed && aiResult.confidence > 0.9) {
      await recordViolation(supabaseAdmin, user.id, "message", content, aiResult.reason, aiResult.confidence);
      return new Response(
        JSON.stringify({
          error: "Message blocked",
          message: "For your safety, sharing personal contact information or social media handles is not allowed. Please keep all communication on the platform.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert message
    const { data: message, error: insertError } = await supabaseAdmin
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id,
        content: content.trim(),
        attachments: attachments || [],
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to send message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message }), {
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
