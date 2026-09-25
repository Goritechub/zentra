import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BlogBlockRenderer } from "@/components/blog/BlogBlockRenderer";
import { estimateReadingMinutes } from "@/lib/readingTime";
import { flattenBlogBlocksToText, type BlogBlock } from "@/types/blog";

interface BlogPreviewProps {
  title: string;
  blocks: BlogBlock[];
  coverImage: string;
  tags: string[];
  authorName: string | null;
  authorAvatar: string | null;
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function BlogPreview({ title, blocks, coverImage, tags, authorName, authorAvatar }: BlogPreviewProps) {
  const content = flattenBlogBlocksToText(blocks);

  return (
    <div>
      {coverImage && (
        <div className="h-64 w-full overflow-hidden md:h-80">
          <img src={coverImage} alt={title} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="mx-auto max-w-[760px] px-6 py-12">
        {tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <h1 className="mb-4 text-3xl font-bold leading-tight text-foreground md:text-4xl">{title || "Untitled"}</h1>
        <div className="mb-8 flex items-center gap-3 border-b border-border pb-6">
          <Avatar className="h-9 w-9">
            <AvatarImage src={authorAvatar || undefined} />
            <AvatarFallback className="bg-primary text-sm text-primary-foreground">
              {getInitials(authorName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{authorName || "You"}</p>
            <p className="text-xs text-muted-foreground">{estimateReadingMinutes(content)} min read · Preview</p>
          </div>
        </div>
        <div className="text-foreground leading-relaxed">
          <BlogBlockRenderer blocks={blocks} legacyContent={content} />
        </div>
      </div>
    </div>
  );
}
