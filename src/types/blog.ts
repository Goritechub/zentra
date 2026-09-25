import { z } from "zod";

export const CURRENT_BLOG_BLOCKS_SCHEMA_VERSION = 2;

const TEXT_BLOCK_TYPES = ["h1", "h2", "h3", "paragraph", "caption", "blockquote"] as const;
const CALLOUT_VARIANTS = ["info", "warning", "success", "tip"] as const;
const VIDEO_PROVIDERS = ["youtube", "vimeo"] as const;

export const BULLET_LIST_STYLES = ["disc", "circle", "square", "arrow"] as const;
export const NUMBERED_LIST_STYLES = ["decimal", "upper-roman", "lower-roman", "upper-alpha", "lower-alpha"] as const;
export type BulletListStyle = (typeof BULLET_LIST_STYLES)[number];
export type NumberedListStyle = (typeof NUMBERED_LIST_STYLES)[number];

// --- API-boundary caps: keep payloads bounded without constraining real posts.
// Mirrors the copy of this schema in zentra-backend/src/modules/blog/blog.service.ts
// — see Phase 0's "keep duplication, catch drift with contract tests" decision.
export const MAX_TITLE_LENGTH = 200;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
const MAX_BLOCKS_PER_POST = 300;
const MAX_BLOCK_TEXT_LENGTH = 10_000;
const MAX_LABEL_LENGTH = 100;
const MAX_URL_LENGTH = 2048;
const MAX_LIST_ITEMS = 200;
const MAX_LIST_ITEM_LENGTH = 2000;
const MAX_TABLE_ROWS = 200;
const MAX_TABLE_COLS = 50;
const MAX_TABLE_CELL_LENGTH = 2000;

const blockId = z.string().min(1, "Block id is required.");

function textBlockSchema<T extends (typeof TEXT_BLOCK_TYPES)[number]>(type: T) {
  return z.object({
    id: blockId,
    type: z.literal(type),
    text: z
      .string()
      .trim()
      .min(1, "Text blocks must have non-empty text.")
      .max(MAX_BLOCK_TEXT_LENGTH, `Text is too long (max ${MAX_BLOCK_TEXT_LENGTH} characters).`),
  });
}

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const blogBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema("h1"),
  textBlockSchema("h2"),
  textBlockSchema("h3"),
  textBlockSchema("paragraph"),
  textBlockSchema("caption"),
  textBlockSchema("blockquote").extend({
    attribution: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(MAX_LABEL_LENGTH, `Attribution is too long (max ${MAX_LABEL_LENGTH} characters).`).optional(),
    ),
  }),
  z.object({
    id: blockId,
    type: z.literal("code"),
    text: z
      .string()
      .trim()
      .min(1, "Code blocks must have non-empty text.")
      .max(MAX_BLOCK_TEXT_LENGTH, `Text is too long (max ${MAX_BLOCK_TEXT_LENGTH} characters).`),
    language: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  }),
  z.object({
    id: blockId,
    type: z.literal("bullet_list"),
    items: z
      .array(z.string().trim().min(1, "Finish or remove empty list items before submitting.").max(MAX_LIST_ITEM_LENGTH, `List item is too long (max ${MAX_LIST_ITEM_LENGTH} characters).`))
      .min(1, "List blocks must have at least one item.")
      .max(MAX_LIST_ITEMS, `Lists can have at most ${MAX_LIST_ITEMS} items.`),
    style: z.enum(BULLET_LIST_STYLES).optional(),
  }),
  z.object({
    id: blockId,
    type: z.literal("numbered_list"),
    items: z
      .array(z.string().trim().min(1, "Finish or remove empty list items before submitting.").max(MAX_LIST_ITEM_LENGTH, `List item is too long (max ${MAX_LIST_ITEM_LENGTH} characters).`))
      .min(1, "List blocks must have at least one item.")
      .max(MAX_LIST_ITEMS, `Lists can have at most ${MAX_LIST_ITEMS} items.`),
    style: z.enum(NUMBERED_LIST_STYLES).optional(),
  }),
  z.object({
    id: blockId,
    type: z.literal("image"),
    url: z.string().trim().url("Image blocks must have a valid image URL.").max(MAX_URL_LENGTH, `URL is too long (max ${MAX_URL_LENGTH} characters).`),
    alt: z.preprocess(emptyToUndefined, z.string().trim().max(MAX_LABEL_LENGTH * 2).optional()),
    decorative: z.boolean().optional(),
  }),
  z.object({
    id: blockId,
    type: z.literal("divider"),
  }),
  z.object({
    id: blockId,
    type: z.literal("callout"),
    text: z
      .string()
      .trim()
      .min(1, "Callout blocks must have non-empty text.")
      .max(MAX_BLOCK_TEXT_LENGTH, `Text is too long (max ${MAX_BLOCK_TEXT_LENGTH} characters).`),
    variant: z.enum(CALLOUT_VARIANTS).optional(),
  }),
  z.object({
    id: blockId,
    type: z.literal("link_preview"),
    url: z.string().trim().url("Link preview blocks must have a valid URL.").max(MAX_URL_LENGTH, `URL is too long (max ${MAX_URL_LENGTH} characters).`),
    title: z.preprocess(emptyToUndefined, z.string().trim().max(MAX_LABEL_LENGTH).optional()),
    description: z.preprocess(emptyToUndefined, z.string().trim().max(MAX_BLOCK_TEXT_LENGTH).optional()),
    image: z.preprocess(emptyToUndefined, z.string().trim().max(MAX_URL_LENGTH).optional()),
  }),
  z.object({
    id: blockId,
    type: z.literal("video"),
    provider: z.enum(VIDEO_PROVIDERS),
    url: z.string().trim().url("Video blocks must have a valid URL.").max(MAX_URL_LENGTH, `URL is too long (max ${MAX_URL_LENGTH} characters).`),
    embedUrl: z.preprocess(emptyToUndefined, z.string().trim().max(MAX_URL_LENGTH).optional()),
    title: z.preprocess(emptyToUndefined, z.string().trim().max(MAX_LABEL_LENGTH).optional()),
  }),
  z.object({
    id: blockId,
    type: z.literal("table"),
    headers: z.array(z.string().max(MAX_TABLE_CELL_LENGTH)).max(MAX_TABLE_COLS, `Tables can have at most ${MAX_TABLE_COLS} columns.`),
    rows: z
      .array(z.array(z.string().max(MAX_TABLE_CELL_LENGTH)).max(MAX_TABLE_COLS, `Tables can have at most ${MAX_TABLE_COLS} columns.`))
      .max(MAX_TABLE_ROWS, `Tables can have at most ${MAX_TABLE_ROWS} rows.`),
  }),
  z.object({
    id: blockId,
    type: z.literal("cta"),
    text: z
      .string()
      .trim()
      .min(1, "CTA blocks must have non-empty text.")
      .max(MAX_BLOCK_TEXT_LENGTH, `Text is too long (max ${MAX_BLOCK_TEXT_LENGTH} characters).`),
    buttonLabel: z.string().trim().min(1, "CTA blocks must have a button label.").max(MAX_LABEL_LENGTH, `Too long (max ${MAX_LABEL_LENGTH} characters).`),
    url: z.string().trim().url("CTA blocks must have a valid URL.").max(MAX_URL_LENGTH, `URL is too long (max ${MAX_URL_LENGTH} characters).`),
  }),
  z.object({
    id: blockId,
    type: z.literal("related_posts"),
  }),
]);

export const blogBlocksSchema = z
  .array(blogBlockSchema)
  .min(1, "At least one content block is required.")
  .max(MAX_BLOCKS_PER_POST, `Posts can have at most ${MAX_BLOCKS_PER_POST} blocks.`)
  .superRefine((blocks, ctx) => {
    blocks.forEach((b, i) => {
      if (b.type === "image" && !b.decorative && !b.alt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Image blocks need alt text, or mark the image as decorative.",
          path: [i, "alt"],
        });
      }
    });
  });

export type BlogBlock = z.infer<typeof blogBlockSchema>;
export type BlogBlockType = BlogBlock["type"];

export function newBlogBlockId(): string {
  return crypto.randomUUID();
}

export function flattenBlogBlocksToText(blocks: BlogBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "image":
          return b.alt || "";
        case "bullet_list":
        case "numbered_list":
          return b.items.join("\n");
        case "callout":
        case "cta":
          return b.text;
        case "link_preview":
        case "video":
          return b.title || "";
        case "table":
          return [b.headers.join(" "), ...b.rows.map((r) => r.join(" "))].join("\n");
        case "divider":
        case "related_posts":
          return "";
        default:
          return b.text;
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
