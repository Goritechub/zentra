import { Helmet } from "react-helmet-async";

const SITE_NAME = "ZentraGig";
const DEFAULT_DESCRIPTION =
  "ZentraGig is the marketplace where businesses find and hire verified engineers, makers, and skilled fabricators. Post a project, get matched with expert talent, and get it built.";
const DEFAULT_IMAGE = "https://zentragig.com/og-image.jpeg";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: "website" | "profile" | "article";
  noIndex?: boolean;
  jsonLd?: object | object[];
}

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  type = "website",
  noIndex = false,
  jsonLd,
}: SEOProps) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Hire Engineers. Build Things.`;
  const canonical = typeof window !== "undefined" ? window.location.href : "";

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@ZentraGig" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd])}
        </script>
      )}
    </Helmet>
  );
}
