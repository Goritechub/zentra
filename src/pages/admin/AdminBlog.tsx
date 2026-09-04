import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Check, Trash2, PenLine, BookOpen } from "lucide-react";
import { getPendingBlogPosts, getBlogPosts, publishBlogPost, rejectBlogPost, type BlogPost } from "@/api/blog.api";
import { cn } from "@/lib/utils";

type PostWithStatus = BlogPost & { status: "active" | "pending" };
type ConfirmAction = { action: "approve" | "reject" | "delete"; post: PostWithStatus };

const getInitials = (name: string | null) => {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

const CONFIRM_MESSAGES: Record<ConfirmAction["action"], (title: string) => string> = {
  approve: (t) => `You are about to publish "${t}". It will become visible to all users.`,
  reject: (t) => `You are about to reject and delete "${t}". This cannot be undone.`,
  delete: (t) => `You are about to delete the published post "${t}". This cannot be undone.`,
};

export default function AdminBlog() {
  const [allPosts, setAllPosts] = useState<PostWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PostWithStatus | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [acting, setActing] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pendingRes, publishedRes] = await Promise.all([
        getPendingBlogPosts(),
        getBlogPosts(1),
      ]);
      const pending: PostWithStatus[] = (pendingRes.posts || []).map((p) => ({ ...p, status: "pending" as const }));
      const active: PostWithStatus[] = (publishedRes.posts || []).map((p) => ({ ...p, status: "active" as const }));
      const combined = [...pending, ...active].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setAllPosts(combined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleConfirm = async () => {
    if (!confirm) return;
    setActing(true);
    const { action, post } = confirm;
    try {
      if (action === "approve") {
        await publishBlogPost(post.id);
        toast.success("Post published successfully");
        setAllPosts((prev) =>
          prev.map((p) => p.id === post.id ? { ...p, status: "active" as const } : p),
        );
        setSelected((prev) => prev?.id === post.id ? { ...prev, status: "active" } : prev);
      } else {
        await rejectBlogPost(post.id);
        toast.success(action === "reject" ? "Post rejected and removed" : "Post deleted");
        setAllPosts((prev) => prev.filter((p) => p.id !== post.id));
        if (selected?.id === post.id) setSelected(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(false);
      setConfirm(null);
    }
  };

  const pendingCount = allPosts.filter((p) => p.status === "pending").length;

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
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">No posts yet</p>
              <p className="text-xs text-muted-foreground mt-1">Posts will appear here once created</p>
            </div>
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
                      {post.status === "pending" ? (
                        <Badge variant="outline" className="text-[10px] border-warning text-warning bg-warning/10">
                          Pending Review
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-success text-success bg-success/10">
                          Published
                        </Badge>
                      )}
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
                    {selected.status === "pending" ? (
                      <Badge variant="outline" className="border-warning text-warning bg-warning/10">
                        Pending Review
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-success text-success bg-success/10">
                        Published
                      </Badge>
                    )}
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

                  <div
                    className="prose prose-sm max-w-none text-foreground [&_*]:text-foreground [&_a]:text-primary"
                    dangerouslySetInnerHTML={{ __html: selected.content }}
                  />
                </div>
              </ScrollArea>

              {/* Action bar */}
              <div className="border-t border-border px-6 py-4 flex-none bg-card">
                {selected.status === "pending" ? (
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
                      onClick={() => setConfirm({ action: "reject", post: selected })}
                    >
                      <Trash2 className="h-4 w-4" /> Reject Post
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => setConfirm({ action: "delete", post: selected })}
                  >
                    <Trash2 className="h-4 w-4" /> Delete Post
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirm} onOpenChange={(open) => { if (!open && !acting) setConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>
              {confirm ? CONFIRM_MESSAGES[confirm.action](confirm.post.title) : ""}
            </DialogDescription>
          </DialogHeader>
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
