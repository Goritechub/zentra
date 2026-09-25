import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ImageIcon, Info, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import type { BlogBlock } from "@/types/blog";
import { getBlogPosts, type BlogPost } from "@/api/blog.api";
import { getListMarker } from "@/lib/listMarkers";

interface BlogBlockRendererProps {
  blocks: BlogBlock[] | null;
  legacyContent: string;
  postId?: string;
  category?: string | null;
}

function ImageBlock({ url, alt }: { url: string; alt?: string }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div className="w-full h-48 rounded-lg bg-muted flex items-center justify-center not-prose">
        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt || ""}
      loading="lazy"
      onError={() => setBroken(true)}
      className="w-full rounded-lg object-cover not-prose"
    />
  );
}

const CALLOUT_ICONS = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  tip: Lightbulb,
} as const;

const CALLOUT_STYLES = {
  info: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  tip: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
} as const;

function CalloutBlock({ text, variant }: { text: string; variant?: keyof typeof CALLOUT_ICONS }) {
  const v = variant || "info";
  const Icon = CALLOUT_ICONS[v];
  return (
    <div className={`not-prose flex gap-2 rounded-lg border p-3 text-sm ${CALLOUT_STYLES[v]}`}>
      <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <p className="m-0">{text}</p>
    </div>
  );
}

function LinkPreviewBlock({
  url,
  title,
  description,
  image,
}: {
  url: string;
  title?: string;
  description?: string;
  image?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="not-prose flex gap-3 rounded-lg border border-border p-3 no-underline hover:bg-accent transition-colors"
    >
      {image && (
        <img src={image} alt="" className="h-16 w-16 rounded-md object-cover flex-shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title || url}</p>
        {description && <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>}
        <p className="text-xs text-muted-foreground truncate">{url}</p>
      </div>
    </a>
  );
}

function VideoBlock({ embedUrl, title }: { embedUrl?: string; title?: string }) {
  if (!embedUrl) return null;
  return (
    <div className="not-prose aspect-video w-full overflow-hidden rounded-lg bg-muted">
      <iframe
        src={embedUrl}
        title={title || "Embedded video"}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="not-prose overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="border-b border-border p-2 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border-b border-border p-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CtaBlock({ text, buttonLabel, url }: { text: string; buttonLabel: string; url: string }) {
  return (
    <div className="not-prose rounded-lg border border-border bg-muted/50 p-4 text-center">
      <p className="mb-3">{text}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-underline hover:opacity-90"
      >
        {buttonLabel}
      </a>
    </div>
  );
}

function RelatedPostsBlock({ postId, category }: { postId?: string; category?: string | null }) {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    let cancelled = false;
    getBlogPosts(1, undefined, undefined, category || undefined)
      .then(({ posts: fetched }) => {
        if (cancelled) return;
        setPosts(fetched.filter((p) => p.id !== postId).slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, category]);

  if (posts.length === 0) return null;

  return (
    <div className="not-prose">
      <p className="text-sm font-semibold text-muted-foreground mb-2">Related posts</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {posts.map((p) => (
          <Link
            key={p.id}
            to={`/blog/${p.id}`}
            className="block rounded-lg border border-border p-3 no-underline hover:bg-accent transition-colors"
          >
            <p className="text-sm font-medium text-foreground line-clamp-2">{p.title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BlogBlockRenderer({ blocks, legacyContent, postId, category }: BlogBlockRendererProps) {
  const hasBlocks = Array.isArray(blocks) && blocks.length > 0;

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      {hasBlocks ? (
        blocks.map((block, i) => {
          const key = block.id ?? i;
          switch (block.type) {
            case "h1":
              return <h1 key={key} id={block.id}>{block.text}</h1>;
            case "h2":
              return <h2 key={key} id={block.id}>{block.text}</h2>;
            case "h3":
              return <h3 key={key} id={block.id}>{block.text}</h3>;
            case "caption":
              return (
                <p key={key} className="text-sm text-muted-foreground italic">
                  {block.text}
                </p>
              );
            case "blockquote":
              return (
                <blockquote key={key}>
                  <p>{block.text}</p>
                  {block.attribution && (
                    <footer className="mt-1 text-sm not-italic text-muted-foreground">
                      — {block.attribution}
                    </footer>
                  )}
                </blockquote>
              );
            case "code":
              return (
                <div key={key} className="not-prose">
                  {block.language && (
                    <div className="text-xs text-muted-foreground mb-1 font-mono">{block.language}</div>
                  )}
                  <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">
                    <code>{block.text}</code>
                  </pre>
                </div>
              );
            case "bullet_list":
            case "numbered_list": {
              const nonEmptyItems = block.items.filter((item) => item.trim() !== "");
              if (nonEmptyItems.length === 0) return null;
              const ListTag = block.type === "bullet_list" ? "ul" : "ol";
              return (
                <ListTag key={key} className="list-none space-y-1 pl-0">
                  {nonEmptyItems.map((item, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="w-6 shrink-0 text-muted-foreground">
                        {getListMarker(block.type, block.style, j)}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ListTag>
              );
            }
            case "image":
              return <ImageBlock key={key} url={block.url} alt={block.decorative ? "" : block.alt} />;
            case "divider":
              return <hr key={key} className="not-prose my-6 border-border" />;
            case "callout":
              return <CalloutBlock key={key} text={block.text} variant={block.variant} />;
            case "link_preview":
              return (
                <LinkPreviewBlock
                  key={key}
                  url={block.url}
                  title={block.title}
                  description={block.description}
                  image={block.image}
                />
              );
            case "video":
              return <VideoBlock key={key} embedUrl={block.embedUrl} title={block.title} />;
            case "table":
              return <TableBlock key={key} headers={block.headers} rows={block.rows} />;
            case "cta":
              return <CtaBlock key={key} text={block.text} buttonLabel={block.buttonLabel} url={block.url} />;
            case "related_posts":
              return <RelatedPostsBlock key={key} postId={postId} category={category} />;
            case "paragraph":
            default:
              return <p key={key}>{block.text}</p>;
          }
        })
      ) : (
        <p className="whitespace-pre-wrap">{legacyContent}</p>
      )}
    </div>
  );
}
