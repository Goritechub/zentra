import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BlogBlockEditor } from "@/components/blog/BlogBlockEditor";
import { BlogPostSettings } from "@/components/blog/BlogPostSettings";
import { BlogPreview } from "@/components/blog/BlogPreview";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Settings2 } from "lucide-react";
import {
  createBlogPost,
  getBlogPostById,
  updateBlogPost,
  submitBlogPostForReview,
  type BlogPostStatus,
} from "@/api/blog.api";
import { MAX_TITLE_LENGTH, type BlogBlock } from "@/types/blog";

const AUTOSAVE_DELAY_MS = 1500;

interface LocalDraft {
  title: string;
  blocks: BlogBlock[];
  category: string;
  tags: string[];
  coverImage: string;
  savedAt: number;
}

function draftStorageKey(postId: string) {
  return `blog-write-draft:${postId}`;
}

const STATUS_LABELS: Record<BlogPostStatus, string> = {
  draft: "Draft",
  submitted: "Submitted for review",
  changes_requested: "Changes requested",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

function primaryActionLabel(status: BlogPostStatus, submitting: boolean) {
  if (submitting) return "Submitting…";
  switch (status) {
    case "draft":
      return "Submit for review";
    case "changes_requested":
      return "Resubmit for review";
    case "submitted":
      return "Awaiting review";
    case "scheduled":
      return "Scheduled";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
  }
}

const BlogWrite = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [postId, setPostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<BlogBlock[]>([]);
  const [category, setCategory] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState("");
  const [status, setStatus] = useState<BlogPostStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  // No :id yet — create a draft immediately and move the URL to it.
  useEffect(() => {
    if (id) return;
    let cancelled = false;
    createBlogPost({})
      .then(({ id: newId }) => {
        if (cancelled) return;
        navigate(`/blog/write/${newId}`, { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Could not start a new post");
        navigate("/blog", { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    hydrated.current = false;

    getBlogPostById(id)
      .then((post) => {
        if (cancelled) return;

        let usedLocal = false;
        try {
          const raw = localStorage.getItem(draftStorageKey(post.id));
          if (raw) {
            const local = JSON.parse(raw) as LocalDraft;
            if (local.savedAt > new Date(post.updated_at).getTime()) {
              setTitle(local.title);
              setBlocks(local.blocks);
              setCategory(local.category);
              setTags(local.tags);
              setCoverImage(local.coverImage);
              usedLocal = true;
              toast.info("Recovered unsaved changes from this browser.");
            }
          }
        } catch {
          // Ignore a corrupt local draft and fall back to the server copy.
        }

        if (!usedLocal) {
          setTitle(post.title);
          setBlocks(post.blocks ?? []);
          setCategory(post.category ?? "");
          setTags(post.tags ?? []);
          setCoverImage(post.cover_image ?? "");
        }

        setPostId(post.id);
        setStatus(post.status);
        hydrated.current = true;
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Could not load this post");
        navigate("/blog", { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const persistLocalDraft = useCallback(() => {
    if (!postId) return;
    const draft: LocalDraft = { title, blocks, category, tags, coverImage, savedAt: Date.now() };
    try {
      localStorage.setItem(draftStorageKey(postId), JSON.stringify(draft));
    } catch {
      // Storage may be full or unavailable — the in-memory state is still the source of truth.
    }
  }, [postId, title, blocks, category, tags, coverImage]);

  const save = useCallback(async () => {
    if (!postId) return;
    setSaving(true);
    try {
      await updateBlogPost(postId, {
        title,
        blocks,
        category: category || undefined,
        tags,
        coverImage,
      });
      try {
        localStorage.removeItem(draftStorageKey(postId));
      } catch {
        // Best-effort cleanup only.
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your changes");
      persistLocalDraft();
    } finally {
      setSaving(false);
    }
  }, [postId, title, blocks, category, tags, coverImage, persistLocalDraft]);

  // Debounced autosave whenever the editable fields change.
  useEffect(() => {
    if (!hydrated.current || !postId) return;
    persistLocalDraft();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save();
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, blocks, category, tags, coverImage]);

  const handleSubmitForReview = async () => {
    if (!postId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSubmitting(true);
    try {
      // Saves and transitions status in a single request instead of a PATCH
      // followed by a separate submit call.
      await submitBlogPostForReview(postId, {
        title,
        blocks,
        category: category || undefined,
        tags,
        coverImage,
      });
      try {
        localStorage.removeItem(draftStorageKey(postId));
      } catch {
        // Best-effort cleanup only.
      }
      toast.success("Submitted for review!");
      navigate("/blog");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit for review");
      persistLocalDraft();
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = status === "draft" || status === "changes_requested";

  if (!id || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const settingsPanel = (
    <BlogPostSettings
      category={category}
      onCategoryChange={setCategory}
      tags={tags}
      onTagsChange={setTags}
      coverImage={coverImage}
      onCoverImageChange={setCoverImage}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEO title="Write a Post" description="Write a new blog post." />

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/blog")}>
            <ArrowLeft className="h-4 w-4" /> All posts
          </Button>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{saving ? "Saving…" : "Saved"}</span>
            <Badge variant="outline">{STATUS_LABELS[status]}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "edit" | "preview")}>
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
            </Tabs>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Post settings">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] p-0 overflow-y-auto">
                {settingsPanel}
              </SheetContent>
            </Sheet>

            {status === "published" && postId && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/blog/${postId}`)}>
                View post
              </Button>
            )}

            <Button onClick={handleSubmitForReview} disabled={!canSubmit || submitting}>
              {primaryActionLabel(status, submitting)}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <section className="flex-1">
          {mode === "edit" ? (
            <div className="mx-auto w-full max-w-[760px] px-6 py-12">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled"
                maxLength={MAX_TITLE_LENGTH}
                className="mb-8 w-full border-none bg-transparent text-4xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40 md:text-5xl"
              />
              <BlogBlockEditor value={blocks} onChange={setBlocks} />
            </div>
          ) : (
            <BlogPreview
              title={title}
              blocks={blocks}
              coverImage={coverImage}
              tags={tags}
              authorName={profile?.full_name ?? null}
              authorAvatar={profile?.avatar_url ?? null}
            />
          )}
        </section>

        <aside className="hidden w-[320px] shrink-0 border-l border-border lg:sticky lg:top-14 lg:block lg:h-[calc(100vh-3.5rem)] lg:self-start lg:overflow-y-auto">
          {settingsPanel}
        </aside>
      </div>
    </div>
  );
};

export default BlogWrite;
