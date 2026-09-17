// Netlify Edge Function — detects link-unfurling bots on blog post URLs and
// serves them static, bot-readable HTML (via the backend's public-preview
// endpoint) instead of the JS-only SPA. Real browsers fall through untouched
// via context.next(). The bare /blog list page shares this function's path
// prefix, so it's explicitly passed through rather than treated as a post id.

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
  const segments = url.pathname.split("/").filter(Boolean); // ["blog", ":id"?]
  if (!segments[1]) {
    return context.next();
  }

  const postId = segments[1];
  const postUrl = `${url.origin}/blog/${encodeURIComponent(postId)}`;
  const imageUrl = `${url.origin}/og-image.jpeg`;

  const fallback = () => Response.redirect(postUrl, 302);

  const apiBaseUrl = Deno.env.get("VITE_API_BASE_URL");
  if (!apiBaseUrl) {
    return fallback();
  }

  try {
    const apiRes = await fetch(`${apiBaseUrl}/blog/posts/${encodeURIComponent(postId)}/public-preview`);
    if (!apiRes.ok) {
      return fallback();
    }
    const body = await apiRes.json();
    const post = body?.data;
    if (!post) {
      return fallback();
    }

    const title = escapeHtml(post.title || "ZentraGig Blog");
    const description = escapeHtml(post.descriptionSnippet || "Read this post on the ZentraGig blog.");
    const safePostUrl = escapeHtml(postUrl);
    const safeImageUrl = escapeHtml(post.image || imageUrl);

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${title} — ZentraGig Blog</title>
<meta name="description" content="${description}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${title} — ZentraGig Blog" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${safeImageUrl}" />
<meta property="og:url" content="${safePostUrl}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title} — ZentraGig Blog" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${safeImageUrl}" />
<meta http-equiv="refresh" content="0; url=${safePostUrl}" />
</head>
<body>
<p>Redirecting to <a href="${safePostUrl}">${title} on ZentraGig</a>&hellip;</p>
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
  path: "/blog/*",
};
