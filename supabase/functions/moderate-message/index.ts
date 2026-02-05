 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 // Patterns to detect private contact information
 const contactPatterns = {
   email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
   phone: /(?:\+?234|0)?[789][01]\d{8}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{11}/gi,
   whatsapp: /whatsapp|whats\s*app|wa\.me|chat\s*me\s*on/gi,
   socialMedia: /(?:instagram|ig|insta|twitter|x\.com|facebook|fb|telegram|tiktok|snapchat|linkedin)[\s:@]?[a-zA-Z0-9._-]*/gi,
   urls: /https?:\/\/[^\s]+|www\.[^\s]+/gi,
 };
 
 // Profanity and spam patterns
 const inappropriatePatterns = {
   profanity: /\b(fuck|shit|damn|ass|bitch|bastard|crap|idiot|stupid)\b/gi,
   spam: /\b(click here|free money|lottery|winner|urgent|act now|limited time|buy now)\b/gi,
   scam: /\b(send money|wire transfer|western union|moneygram|bitcoin wallet|crypto wallet|bank account|sort code|routing number)\b/gi,
 };
 
 interface ModerationResult {
   approved: boolean;
   sanitizedContent: string;
   violations: string[];
 }
 
 function moderateContent(content: string): ModerationResult {
   const violations: string[] = [];
   let sanitizedContent = content;
 
   // Check for email addresses
   if (contactPatterns.email.test(content)) {
     violations.push("Email addresses are not allowed");
     sanitizedContent = sanitizedContent.replace(contactPatterns.email, "[EMAIL REMOVED]");
   }
 
   // Check for phone numbers
   if (contactPatterns.phone.test(content)) {
     violations.push("Phone numbers are not allowed");
     sanitizedContent = sanitizedContent.replace(contactPatterns.phone, "[PHONE REMOVED]");
   }
 
   // Check for WhatsApp references
   if (contactPatterns.whatsapp.test(content)) {
     violations.push("WhatsApp contact sharing is not allowed");
     sanitizedContent = sanitizedContent.replace(contactPatterns.whatsapp, "[CONTACT REMOVED]");
   }
 
   // Check for social media handles
   if (contactPatterns.socialMedia.test(content)) {
     violations.push("Social media handles are not allowed");
     sanitizedContent = sanitizedContent.replace(contactPatterns.socialMedia, "[SOCIAL REMOVED]");
   }
 
   // Check for URLs
   if (contactPatterns.urls.test(content)) {
     violations.push("External links are not allowed");
     sanitizedContent = sanitizedContent.replace(contactPatterns.urls, "[LINK REMOVED]");
   }
 
   // Check for profanity
   if (inappropriatePatterns.profanity.test(content)) {
     violations.push("Inappropriate language detected");
     sanitizedContent = sanitizedContent.replace(inappropriatePatterns.profanity, "***");
   }
 
   // Check for spam
   if (inappropriatePatterns.spam.test(content)) {
     violations.push("Spam content detected");
   }
 
   // Check for scam patterns
   if (inappropriatePatterns.scam.test(content)) {
     violations.push("Potential scam content detected - message blocked");
     return { approved: false, sanitizedContent: "", violations };
   }
 
   // If there are contact violations, block the message entirely
   const contactViolations = violations.filter(v => 
     v.includes("Email") || v.includes("Phone") || v.includes("WhatsApp") || 
     v.includes("Social media") || v.includes("External links")
   );
 
   if (contactViolations.length > 0) {
     return { approved: false, sanitizedContent: "", violations };
   }
 
   return { 
     approved: violations.length === 0 || !violations.some(v => v.includes("blocked")), 
     sanitizedContent: sanitizedContent.trim(), 
     violations 
   };
 }
 
 serve(async (req) => {
   // Handle CORS preflight
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabaseClient = createClient(
       Deno.env.get('SUPABASE_URL') ?? '',
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
     );
 
     // Get auth token from request
     const authHeader = req.headers.get('Authorization');
     if (!authHeader) {
       return new Response(
         JSON.stringify({ error: 'Missing authorization header' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Verify the user
     const token = authHeader.replace('Bearer ', '');
     const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
     
     if (authError || !user) {
       console.error('Auth error:', authError);
       return new Response(
         JSON.stringify({ error: 'Unauthorized' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const { receiver_id, content, attachments } = await req.json();
 
     if (!receiver_id || !content) {
       return new Response(
         JSON.stringify({ error: 'Missing required fields: receiver_id and content' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Moderate the content
     const moderationResult = moderateContent(content);
     console.log('Moderation result:', moderationResult);
 
     if (!moderationResult.approved) {
       return new Response(
         JSON.stringify({ 
           error: 'Message blocked',
           violations: moderationResult.violations,
           message: 'Your message was blocked because it contains content that violates our policies. Please keep all communication on the platform.'
         }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Insert the message with sanitized content
     const { data: message, error: insertError } = await supabaseClient
       .from('messages')
       .insert({
         sender_id: user.id,
         receiver_id,
         content: moderationResult.sanitizedContent,
         attachments: attachments || [],
       })
       .select()
       .single();
 
     if (insertError) {
       console.error('Insert error:', insertError);
       return new Response(
         JSON.stringify({ error: 'Failed to send message' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     return new Response(
       JSON.stringify({ 
         success: true, 
         message,
         warnings: moderationResult.violations.length > 0 ? moderationResult.violations : undefined
       }),
       { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error) {
     console.error('Server error:', error);
     return new Response(
       JSON.stringify({ error: 'Internal server error' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });