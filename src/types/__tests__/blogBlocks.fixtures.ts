// Shared contract fixtures for the blog block schema.
// A duplicate of this file lives in zentra-backend's test suite — both repos assert
// their own (independently duplicated) zod schema against the same cases, so drift
// between the two schemas is caught by tests instead of a shared package.

export const validBlockArrays: unknown[][] = [
  [{ id: "b1", type: "paragraph", text: "Hello world" }],
  [{ id: "b1", type: "h1", text: "Title" }, { id: "b2", type: "paragraph", text: "Body" }],
  [{ id: "b1", type: "blockquote", text: "A quote" }],
  [{ id: "b1", type: "code", text: "console.log(1)", language: "ts" }],
  [{ id: "b1", type: "code", text: "console.log(1)" }],
  [{ id: "b1", type: "bullet_list", items: ["one", "two"] }],
  [{ id: "b1", type: "numbered_list", items: ["one", "two"] }],
  [{ id: "b1", type: "image", url: "https://example.com/a.png", alt: "An image" }],
  [{ id: "b1", type: "image", url: "https://example.com/a.png", decorative: true }],
  [{ id: "b1", type: "divider" }],
  [{ id: "b1", type: "callout", text: "Heads up", variant: "warning" }],
  [{ id: "b1", type: "callout", text: "Heads up" }],
  [{ id: "b1", type: "link_preview", url: "https://example.com/article" }],
  [
    {
      id: "b1",
      type: "link_preview",
      url: "https://example.com/article",
      title: "Article title",
      description: "Article description",
      image: "https://example.com/thumb.png",
    },
  ],
  [{ id: "b1", type: "video", provider: "youtube", url: "https://youtube.com/watch?v=abc" }],
  [
    {
      id: "b1",
      type: "video",
      provider: "vimeo",
      url: "https://vimeo.com/123",
      embedUrl: "https://player.vimeo.com/video/123",
      title: "A video",
    },
  ],
  [{ id: "b1", type: "table", headers: ["A", "B"], rows: [["1", "2"]] }],
  [{ id: "b1", type: "table", headers: [], rows: [] }],
  [{ id: "b1", type: "cta", text: "Ready?", buttonLabel: "Sign up", url: "https://example.com/signup" }],
  [{ id: "b1", type: "related_posts" }],
];

export const invalidBlockArrays: unknown[][] = [
  [], // at least one block required
  [{ type: "paragraph", text: "Missing id" }], // id required
  [{ id: "b1", type: "paragraph", text: "" }], // empty text
  [{ id: "b1", type: "bullet_list", items: [] }], // empty list
  [{ id: "b1", type: "bullet_list", items: [""] }], // empty list item
  [{ id: "b1", type: "image", url: "not-a-url" }], // invalid URL
  [{ id: "b1", type: "unknown_block_type", text: "x" }], // unknown discriminant
  [{ id: "b1", type: "image", url: "https://example.com/a.png" }], // needs alt text or decorative
  [{ id: "b1", type: "callout", text: "" }], // empty callout text
  [{ id: "b1", type: "link_preview", url: "not-a-url" }], // invalid URL
  [{ id: "b1", type: "video", provider: "youtube", url: "not-a-url" }], // invalid URL
  [{ id: "b1", type: "video", provider: "dailymotion", url: "https://example.com" }], // unsupported provider
  [{ id: "b1", type: "cta", text: "Ready?", buttonLabel: "", url: "https://example.com" }], // empty button label
  [{ id: "b1", type: "cta", text: "Ready?", buttonLabel: "Go", url: "not-a-url" }], // invalid URL
  [{ id: "b1", type: "paragraph", text: "x".repeat(10_001) }], // exceeds block text length cap
  [{ id: "b1", type: "cta", text: "Ready?", buttonLabel: "x".repeat(101), url: "https://example.com" }], // exceeds label length cap
];
