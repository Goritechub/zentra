import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Trash2, Clock, PenLine } from "lucide-react";
import { getPendingBlogPosts, publishBlogPost, rejectBlogPost, type BlogPost } from "@/api/blog.api";

const getInitials = (name: string | null) => {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

export default function AdminBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const { posts: data } = await getPendingBlogPosts();
      setPosts(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load pending posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handlePublish = async (postId: string) => {
    setActing(postId);
    try {
      await publishBlogPost(postId);
      toast.success("Post published");
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      toast.error(err.message || "Failed to publish post");
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (postId: string) => {
    setActing(postId);
    try {
      await rejectBlogPost(postId);
      toast.success("Post rejected and removed");
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      toast.error(err.message || "Failed to reject post");
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Blog Moderation</h2>
        <p className="text-muted-foreground text-sm mt-1">Review and approve submitted posts before they go live.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-32 bg-muted rounded-t-lg" />
              <CardContent className="p-4 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <PenLine className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No pending posts</h3>
          <p className="text-muted-foreground mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map((post) => (
            <Card key={post.id} className="overflow-hidden flex flex-col">
              <CardContent className="p-4 flex flex-col gap-3 flex-1">
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {post.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                )}

                <h3 className="font-semibold text-foreground line-clamp-2 leading-tight">{post.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{post.content}</p>

                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={post.author.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                      {getInitials(post.author.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground truncate">{post.author.full_name || "Anonymous"}</span>
                  <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(post.created_at), "MMM d")}
                  </span>
                </div>

                <div className="flex gap-2 pt-1 border-t border-border">
                  <Button
                    size="sm"
                    className="flex-1 gap-1"
                    disabled={acting === post.id}
                    onClick={() => handlePublish(post.id)}
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 gap-1"
                    disabled={acting === post.id}
                    onClick={() => handleReject(post.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
