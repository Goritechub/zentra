import { useState } from "react";
import { ImageIcon, ChevronUp, ChevronDown, Trash2, Plus, GripVertical, Link2, Video as VideoIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { AutoResizeTextarea } from "@/components/blog/AutoResizeTextarea";
import { BlogListBlockEditor } from "@/components/blog/BlogListBlockEditor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { fetchBlogLinkPreview, fetchBlogVideoEmbed } from "@/api/blog.api";
import type { BlogBlock, BlogBlockType } from "@/types/blog";
import { newBlogBlockId } from "@/types/blog";

interface BlogBlockEditorProps {
  value: BlogBlock[];
  onChange: (blocks: BlogBlock[]) => void;
}

const BLOCK_TYPE_LABELS: Record<BlogBlockType, string> = {
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  paragraph: "Normal text",
  caption: "Small text (caption)",
  blockquote: "Quote",
  code: "Code block",
  bullet_list: "Bulleted list",
  numbered_list: "Numbered list",
  image: "Image",
  divider: "Divider",
  callout: "Callout",
  link_preview: "Link preview",
  video: "Video embed",
  table: "Table",
  cta: "Call to action",
  related_posts: "Related posts",
};

const BLOCK_TYPES: BlogBlockType[] = [
  "h1", "h2", "h3", "paragraph", "caption", "blockquote", "code",
  "bullet_list", "numbered_list", "image", "divider", "callout",
  "link_preview", "video", "table", "cta", "related_posts",
];

const CALLOUT_VARIANTS = ["info", "warning", "success", "tip"] as const;

type TextBlockType = "h1" | "h2" | "h3" | "paragraph" | "caption" | "blockquote";

const TEXT_BLOCK_STYLES: Record<TextBlockType, string> = {
  h1: "text-3xl font-bold tracking-tight",
  h2: "text-2xl font-semibold tracking-tight",
  h3: "text-xl font-semibold",
  paragraph: "text-base leading-7",
  caption: "text-sm italic text-muted-foreground",
  blockquote: "text-lg italic text-muted-foreground border-l-2 border-border pl-5 leading-7",
};

function isTextBlockType(type: BlogBlockType): type is TextBlockType {
  return type === "h1" || type === "h2" || type === "h3" || type === "paragraph" || type === "caption" || type === "blockquote";
}

function blockToPlainText(block: BlogBlock): string {
  if (block.type === "bullet_list" || block.type === "numbered_list") return block.items.join("\n");
  if ("text" in block) return block.text;
  return "";
}

function emptyBlockOfType(type: BlogBlockType): BlogBlock {
  const id = newBlogBlockId();
  switch (type) {
    case "image":
      return { id, type: "image", url: "", alt: "" };
    case "bullet_list":
    case "numbered_list":
      return { id, type, items: [""] };
    case "code":
      return { id, type: "code", text: "", language: "" };
    case "divider":
      return { id, type: "divider" };
    case "callout":
      return { id, type: "callout", text: "", variant: "info" };
    case "link_preview":
      return { id, type: "link_preview", url: "" };
    case "video":
      return { id, type: "video", provider: "youtube", url: "" };
    case "table":
      return { id, type: "table", headers: ["", ""], rows: [["", ""]] };
    case "cta":
      return { id, type: "cta", text: "", buttonLabel: "", url: "" };
    case "related_posts":
      return { id, type: "related_posts" };
    default:
      return { id, type, text: "" };
  }
}

export function BlogBlockEditor({ value, onChange }: BlogBlockEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [slashIndex, setSlashIndex] = useState<number | null>(null);
  const [slashActive, setSlashActive] = useState(0);
  const [linkPreviewLoading, setLinkPreviewLoading] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState<string | null>(null);

  const updateBlock = (index: number, block: BlogBlock) => {
    onChange(value.map((b, i) => (i === index ? block : b)));
  };

  const changeType = (index: number, type: BlogBlockType) => {
    const current = value[index];
    if (current.type === type) return;

    if (type === "image") {
      updateBlock(index, { id: current.id, type: "image", url: "", alt: "" });
    } else if (type === "bullet_list" || type === "numbered_list") {
      const lines = blockToPlainText(current).split("\n").map((l) => l.trim()).filter(Boolean);
      updateBlock(index, { id: current.id, type, items: lines.length > 0 ? lines : [""] });
    } else if (type === "code") {
      updateBlock(index, {
        id: current.id,
        type: "code",
        text: blockToPlainText(current),
        language: current.type === "code" ? current.language ?? "" : "",
      });
    } else if (isTextBlockType(type) || type === "callout") {
      updateBlock(index, { ...emptyBlockOfType(type), id: current.id, text: blockToPlainText(current) } as BlogBlock);
    } else {
      updateBlock(index, { ...emptyBlockOfType(type), id: current.id });
    }
  };

  const removeBlock = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const addBlock = (type: BlogBlockType, atIndex?: number) => {
    const block = emptyBlockOfType(type);
    if (atIndex === undefined) {
      onChange([...value, block]);
    } else {
      const next = [...value];
      next.splice(atIndex, 0, block);
      onChange(next);
    }
  };

  const exitList = (index: number) => {
    const paragraph = emptyBlockOfType("paragraph");
    const next = [...value];
    next.splice(index + 1, 0, paragraph);
    onChange(next);
    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>(`[data-block-id="${paragraph.id}"] textarea`)?.focus();
    });
  };

  const handleSlashSelect = (index: number, type: BlogBlockType) => {
    changeType(index, type);
    setSlashIndex(null);
  };

  const slashMatches = (index: number) => {
    const block = value[index];
    if (!("text" in block)) return [];
    const query = block.text.slice(1).toLowerCase();
    return BLOCK_TYPES.filter((t) => BLOCK_TYPE_LABELS[t].toLowerCase().includes(query));
  };

  const runLinkPreview = async (index: number, id: string, url: string) => {
    if (!url.trim()) return;
    setLinkPreviewLoading(id);
    try {
      const data = await fetchBlogLinkPreview(url.trim());
      const current = value[index];
      if (current.type !== "link_preview") return;
      updateBlock(index, { ...current, title: data.title, description: data.description, image: data.image });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load a preview for that link");
    } finally {
      setLinkPreviewLoading(null);
    }
  };

  const runVideoEmbed = async (index: number, id: string, url: string) => {
    if (!url.trim()) return;
    setVideoLoading(id);
    try {
      const data = await fetchBlogVideoEmbed(url.trim());
      const current = value[index];
      if (current.type !== "video") return;
      updateBlock(index, { ...current, provider: data.provider, embedUrl: data.embedUrl, title: data.title });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not embed that video");
    } finally {
      setVideoLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      {value.map((block, index) => (
        <div
          key={block.id}
          data-block-id={block.id}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null) reorder(dragIndex, index);
            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
          className={`group relative -mx-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/30 focus-within:bg-muted/30 ${dragIndex === index ? "opacity-50" : ""}`}
        >
          <span
            className="absolute -left-6 top-3 hidden cursor-grab text-muted-foreground/50 opacity-0 transition-opacity hover:text-muted-foreground group-hover:opacity-100 group-focus-within:opacity-100 lg:block"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </span>

          <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-border bg-background p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Select value={block.type} onValueChange={(v) => changeType(index, v as BlogBlockType)}>
              <SelectTrigger className="h-7 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {BLOCK_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={index === 0}
              onClick={() => moveBlock(index, -1)}
              aria-label="Move block up"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={index === value.length - 1}
              onClick={() => moveBlock(index, 1)}
              aria-label="Move block down"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => removeBlock(index)}
              aria-label="Delete block"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-2">
          {block.type === "image" ? (
            <div className="space-y-2">
              <Input
                placeholder="Image URL (https://...)"
                value={block.url}
                onChange={(e) => updateBlock(index, { ...block, url: e.target.value })}
              />
              <Input
                placeholder="Alt text (required unless marked decorative)"
                value={block.alt || ""}
                onChange={(e) => updateBlock(index, { ...block, alt: e.target.value })}
                disabled={!!block.decorative}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={!!block.decorative}
                  onCheckedChange={(checked) => updateBlock(index, { ...block, decorative: !!checked })}
                />
                Decorative image (no alt text needed)
              </label>
              {block.url ? (
                <img
                  src={block.url}
                  alt={block.alt || ""}
                  className="w-full max-h-40 object-cover rounded-md border border-border"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  onLoad={(e) => {
                    e.currentTarget.style.display = "block";
                  }}
                />
              ) : (
                <div className="h-24 rounded-md border border-dashed border-border flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
            </div>
          ) : block.type === "bullet_list" || block.type === "numbered_list" ? (
            <BlogListBlockEditor
              type={block.type}
              items={block.items}
              style={block.style}
              onChange={(patch) => updateBlock(index, { id: block.id, ...patch } as BlogBlock)}
              onDissolve={() => updateBlock(index, { id: block.id, type: "paragraph", text: "" })}
              onExitList={() => exitList(index)}
            />
          ) : block.type === "code" ? (
            <div className="space-y-2">
              <AutoResizeTextarea
                placeholder="Code"
                value={block.text}
                onChange={(e) => updateBlock(index, { ...block, text: e.target.value })}
                className="rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-xs"
              />
              <Input
                placeholder="Language (optional, e.g. ts, python)"
                value={block.language || ""}
                onChange={(e) => updateBlock(index, { ...block, language: e.target.value })}
              />
            </div>
          ) : block.type === "divider" ? (
            <div className="py-2 text-center text-xs text-muted-foreground">── divider ──</div>
          ) : block.type === "callout" ? (
            <div className="space-y-2">
              <Select
                value={block.variant || "info"}
                onValueChange={(v) => updateBlock(index, { ...block, variant: v as (typeof CALLOUT_VARIANTS)[number] })}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALLOUT_VARIANTS.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Callout text"
                value={block.text}
                onChange={(e) => updateBlock(index, { ...block, text: e.target.value })}
                className="resize-none text-sm"
                rows={2}
              />
            </div>
          ) : block.type === "link_preview" ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Paste a link (https://...)"
                  value={block.url}
                  onChange={(e) => updateBlock(index, { ...block, url: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={linkPreviewLoading === block.id || !block.url.trim()}
                  onClick={() => runLinkPreview(index, block.id, block.url)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {block.title && (
                <div className="rounded-md border border-border p-2 text-xs space-y-0.5">
                  <p className="font-medium text-foreground">{block.title}</p>
                  {block.description && <p className="text-muted-foreground line-clamp-2">{block.description}</p>}
                </div>
              )}
            </div>
          ) : block.type === "video" ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="YouTube or Vimeo link"
                  value={block.url}
                  onChange={(e) => updateBlock(index, { ...block, url: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={videoLoading === block.id || !block.url.trim()}
                  onClick={() => runVideoEmbed(index, block.id, block.url)}
                >
                  <VideoIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
              {block.embedUrl && (
                <p className="text-xs text-muted-foreground">
                  Embedded {block.provider} video{block.title ? `: ${block.title}` : ""}
                </p>
              )}
            </div>
          ) : block.type === "table" ? (
            <TableBlockEditor
              headers={block.headers}
              rows={block.rows}
              onChange={(headers, rows) => updateBlock(index, { ...block, headers, rows })}
            />
          ) : block.type === "cta" ? (
            <div className="space-y-2">
              <Textarea
                placeholder="CTA text"
                value={block.text}
                onChange={(e) => updateBlock(index, { ...block, text: e.target.value })}
                className="resize-none text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Button label"
                  value={block.buttonLabel}
                  onChange={(e) => updateBlock(index, { ...block, buttonLabel: e.target.value })}
                />
                <Input
                  placeholder="Button URL"
                  value={block.url}
                  onChange={(e) => updateBlock(index, { ...block, url: e.target.value })}
                />
              </div>
            </div>
          ) : block.type === "related_posts" ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Related posts will be shown here automatically.
            </p>
          ) : (
            <div className="relative">
              <AutoResizeTextarea
                placeholder={`${BLOCK_TYPE_LABELS[block.type]} — type "/" to change block type`}
                value={block.text}
                onChange={(e) => {
                  updateBlock(index, { ...block, text: e.target.value });
                  setSlashIndex(e.target.value.startsWith("/") ? index : null);
                  setSlashActive(0);
                }}
                onKeyDown={(e) => {
                  const matches = slashIndex === index ? slashMatches(index) : [];
                  if (matches.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setSlashActive((a) => Math.min(a + 1, matches.length - 1));
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setSlashActive((a) => Math.max(a - 1, 0));
                      return;
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSlashSelect(index, matches[Math.min(slashActive, matches.length - 1)]);
                      return;
                    }
                  }
                  if (e.key === "Escape") setSlashIndex(null);
                }}
                className={`placeholder:text-muted-foreground/40 ${isTextBlockType(block.type) ? TEXT_BLOCK_STYLES[block.type] : ""}`}
              />
              {slashIndex === index && slashMatches(index).length > 0 && (
                <div className="absolute z-10 mt-1 w-56 rounded-md border border-border bg-popover shadow-md py-1 max-h-56 overflow-auto">
                  {slashMatches(index).map((t, i) => (
                    <button
                      key={t}
                      type="button"
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent ${i === slashActive ? "bg-accent" : ""}`}
                      onMouseEnter={() => setSlashActive(i)}
                      onClick={() => handleSlashSelect(index, t)}
                    >
                      {BLOCK_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
              {block.type === "blockquote" && (
                <Input
                  placeholder="Attribution (optional) — e.g. a name"
                  value={block.attribution ?? ""}
                  onChange={(e) => updateBlock(index, { ...block, attribution: e.target.value })}
                  className="mt-1.5 h-8 max-w-xs text-sm text-muted-foreground"
                />
              )}
            </div>
          )}
          </div>
        </div>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="w-full gap-2">
            <Plus className="h-4 w-4" /> Add block
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-auto">
          {BLOCK_TYPES.map((t) => (
            <DropdownMenuItem key={t} onClick={() => addBlock(t)}>
              {BLOCK_TYPE_LABELS[t]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TableBlockEditor({
  headers,
  rows,
  onChange,
}: {
  headers: string[];
  rows: string[][];
  onChange: (headers: string[], rows: string[][]) => void;
}) {
  const setHeader = (i: number, v: string) => {
    const next = [...headers];
    next[i] = v;
    onChange(next, rows);
  };
  const setCell = (r: number, c: number, v: string) => {
    const next = rows.map((row) => [...row]);
    next[r][c] = v;
    onChange(headers, next);
  };
  const addColumn = () => {
    onChange([...headers, ""], rows.map((row) => [...row, ""]));
  };
  const removeColumn = (i: number) => {
    if (headers.length <= 1) return;
    onChange(
      headers.filter((_, idx) => idx !== i),
      rows.map((row) => row.filter((_, idx) => idx !== i)),
    );
  };
  const addRow = () => {
    onChange(headers, [...rows, headers.map(() => "")]);
  };
  const removeRow = (r: number) => {
    if (rows.length <= 1) return;
    onChange(headers, rows.filter((_, idx) => idx !== r));
  };

  return (
    <div className="space-y-2 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="p-1">
                <div className="flex items-center gap-1">
                  <Input
                    value={h}
                    placeholder={`Column ${i + 1}`}
                    onChange={(e) => setHeader(i, e.target.value)}
                    className="h-7 text-xs"
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeColumn(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="p-1">
                  <Input value={cell} onChange={(e) => setCell(r, c, e.target.value)} className="h-7 text-xs" />
                </td>
              ))}
              <td>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(r)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>Add row</Button>
        <Button type="button" variant="outline" size="sm" onClick={addColumn}>Add column</Button>
      </div>
    </div>
  );
}
