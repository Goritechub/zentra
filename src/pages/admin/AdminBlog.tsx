import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Check, Trash2, PenLine } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import {
  getModerationBlogPosts,
  publishBlogPost,
  requestBlogPostChanges,
  archiveBlogPost,
  type BlogPost,
  type BlogPostStatus,
} from "@/api/blog.api";
import { cn } from "@/lib/utils";
import { BlogBlockRenderer } from "@/components/blog/BlogBlockRenderer";

type ConfirmAction = { action: "approve" | "request-changes" | "archive"; post: BlogPost };

const getInitials = (name: string | null) => {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

const CONFIRM_MESSAGES: Record<ConfirmAction["action"], (title: string) => string> = {
  approve: (t) => `You are about to publish "${t}". It will become visible to all users.`,
  "request-changes": (t) => `Send "${t}" back to the author with feedback. It will not be deleted.`,
  archive: (t) => `You are about to archive "${t}". It will be removed from public view.`,
};

const STATUS_BADGE: Record<BlogPostStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-muted-foreground text-muted-foreground bg-muted" },
  submitted: { label: "Pending Review", className: "border-warning text-warning bg-warning/10" },
  changes_requested: { label: "Changes Requested", className: "border-destructive text-destructive bg-destructive/10" },
  scheduled: { label: "Scheduled", className: "border-primary text-primary bg-primary/10" },
  published: { label: "Published", className: "border-success text-success bg-success/10" },
  archived: { label: "Archived", className: "border-muted-foreground text-muted-foreground bg-muted" },
};

export default function AdminBlog() {
  const [allPosts, setAllPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BlogPost | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [acting, setActing] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { posts } = await getModerationBlogPosts();
      setAllPosts(posts || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleConfirm = async () => {
    if (!confirm) return;
    if (confirm.action === "request-changes" && !reviewMessage.trim()) {
      toast.error("Please explain what needs to change");
      return;
    }
    setActing(true);
    const { action, post } = confirm;
    try {
      if (action === "approve") {
        await publishBlogPost(post.id);
        toast.success("Post published successfully");
        setAllPosts((prev) =>
          prev.map((p) => p.id === post.id ? { ...p, status: "published" as const } : p),
        );
        setSelected((prev) => prev?.id === post.id ? { ...prev, status: "published" } : prev);
      } else if (action === "request-changes") {
        await requestBlogPostChanges(post.id, reviewMessage.trim());
        toast.success("Changes requested — the author has been notified");
        setAllPosts((prev) => prev.filter((p) => p.id !== post.id));
        if (selected?.id === post.id) setSelected(null);
      } else {
        await archiveBlogPost(post.id);
        toast.success("Post archived");
        setAllPosts((prev) => prev.filter((p) => p.id !== post.id));
        if (selected?.id === post.id) setSelected(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(false);
      setConfirm(null);
      setReviewMessage("");
    }
  };

  const pendingCount = allPosts.filter((p) => p.status === "submitted").length;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-0">
      {/* Header */}
      <div className="mb-4 flex-none">
        <h2 className="text-2xl font-bold text-foreground">Blog Moderation</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Review and manage all blog posts.
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-warning font-medium">
              {pendingCount} pending review
            </span>
          )}
        </p>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left 1/3 — post list */}
        <div className="w-1/3 min-w-0 flex flex-col border border-border rounded-lg overflow-hidden bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-none">
            <span className="text-sm font-semibold text-foreground">All Posts</span>
            <span className="text-xs text-muted-foreground">{allPosts.length} total</span>
          </div>

          {loading ? (
            <div className="flex-1 p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-1.5 p-3 rounded-md border border-border">
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : allPosts.length === 0 ? (
            <EmptyState variant="documents" title="No posts yet" description="Posts will appear here once created" compact />
          ) : (
            <ScrollArea className="flex-1">
              <div className="divide-y divide-border">
                {allPosts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => setSelected(post)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                      selected?.id === post.id && "bg-accent",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn("text-[10px]", STATUS_BADGE[post.status].className)}>
                        {STATUS_BADGE[post.status].label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate leading-snug">{post.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {post.author.full_name || "Anonymous"} · {format(new Date(post.created_at), "MMM d, yyyy")}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Right 2/3 — post detail */}
        <div className="flex-1 min-w-0 flex flex-col border border-border rounded-lg overflow-hidden bg-card">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <PenLine className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium text-foreground">Select a post</p>
              <p className="text-xs text-muted-foreground mt-1">Click any post on the left to view details</p>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1">
                {selected.cover_image && (
                  <img
                    src={selected.cover_image}
                    alt={selected.title}
                    className="w-full max-h-48 object-cover"
                  />
                )}
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={STATUS_BADGE[selected.status].className}>
                      {STATUS_BADGE[selected.status].label}
                    </Badge>
                  </div>

                  <h1 className="text-2xl font-bold text-foreground leading-tight">{selected.title}</h1>

                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selected.author.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {getInitials(selected.author.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{selected.author.full_name || "Anonymous"}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(selected.created_at), "MMMM d, yyyy")}</p>
                    </div>
                  </div>

                  {selected.tags && selected.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="prose-sm max-w-none text-foreground [&_*]:text-foreground [&_a]:text-primary">
                    <BlogBlockRenderer blocks={selected.blocks} legacyContent={selected.content} />
                  </div>
                </div>
              </ScrollArea>

              {/* Action bar */}
              <div className="border-t border-border px-6 py-4 flex-none bg-card">
                {selected.status === "submitted" ? (
                  <div className="flex gap-3">
                    <Button
                      className="gap-1.5"
                      onClick={() => setConfirm({ action: "approve", post: selected })}
                    >
                      <Check className="h-4 w-4" /> Approve & Publish
                    </Button>
                    <Button
                      variant="destructive"
                      className="gap-1.5"
                      onClick={() => setConfirm({ action: "request-changes", post: selected })}
                    >
                      <Trash2 className="h-4 w-4" /> Request Changes
                    </Button>
                  </div>
                ) : selected.status === "archived" ? (
                  <p className="text-sm text-muted-foreground">This post is archived.</p>
                ) : (
                  <Button
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => setConfirm({ action: "archive", post: selected })}
                  >
                    <Trash2 className="h-4 w-4" /> Archive Post
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirm} onOpenChange={(open) => { if (!open && !acting) { setConfirm(null); setReviewMessage(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>
              {confirm ? CONFIRM_MESSAGES[confirm.action](confirm.post.title) : ""}
            </DialogDescription>
          </DialogHeader>
          {confirm?.action === "request-changes" && (
            <Textarea
              placeholder="Explain what the author should change..."
              value={reviewMessage}
              onChange={(e) => setReviewMessage(e.target.value)}
              rows={4}
              autoFocus
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={acting}>
              Cancel
            </Button>
            <Button
              variant={confirm?.action === "approve" ? "default" : "destructive"}
              onClick={handleConfirm}
              disabled={acting}
            >
              {acting ? "Processing…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
