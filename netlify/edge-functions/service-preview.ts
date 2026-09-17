// Netlify Edge Function — detects link-unfurling bots on service detail URLs and
// serves them static, bot-readable HTML (via the backend's public-preview
// endpoint) instead of the JS-only SPA. Real browsers fall through untouched
// to the normal client-rendered app via context.next().

import type { Config, Context } from "https://edge.netlify.com";

const BOT_UA_REGEX =
  /facebookexternalhit|Facebot|WhatsApp|TelegramBot|Slackbot|Twitterbot|LinkedInBot|Discordbot|Applebot|SkypeUriPreview|redditbot|Pinterest|vkShare|Googlebot|Bingbot|Embedly|Iframely|W3C_Validator/i;

function escapeHtml(value: string | undefined | null): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default async (request: Request, context: Context) => {
  const userAgent = request.headers.get("user-agent") || "";
  if (!BOT_UA_REGEX.test(userAgent)) {
    return context.next();
  }

  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean); // ["service", ":id", ...]
  const serviceId = segments[1];
  const serviceUrl = `${url.origin}/service/${encodeURIComponent(serviceId || "")}`;
  const imageUrl = `${url.origin}/og-image.jpeg`;

  const fallback = () => Response.redirect(serviceUrl, 302);

  const apiBaseUrl = Deno.env.get("VITE_API_BASE_URL");
  if (!serviceId || !apiBaseUrl) {
    return fallback();
  }

  try {
    const apiRes = await fetch(`${apiBaseUrl}/services/${encodeURIComponent(serviceId)}/public-preview`);
    if (!apiRes.ok) {
      return fallback();
    }
    const body = await apiRes.json();
    const service = body?.data;
    if (!service) {
      return fallback();
    }

    const title = escapeHtml(service.title || "ZentraGig Service");
    const description = escapeHtml(service.descriptionSnippet || "View this service on ZentraGig.");
    const safeServiceUrl = escapeHtml(serviceUrl);
    const safeImageUrl = escapeHtml(service.image || imageUrl);

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${title} — ZentraGig</title>
<meta name="description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${title} — ZentraGig" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${safeImageUrl}" />
<meta property="og:url" content="${safeServiceUrl}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title} — ZentraGig" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${safeImageUrl}" />
<meta http-equiv="refresh" content="0; url=${safeServiceUrl}" />
</head>
<body>
<p>Redirecting to <a href="${safeServiceUrl}">${title} on ZentraGig</a>&hellip;</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return fallback();
  }
};

export const config: Config = {
  path: "/service/*",
};
