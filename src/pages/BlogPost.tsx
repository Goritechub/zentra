import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Heart, Clock, Twitter, Facebook, Linkedin,
  Link as LinkIcon, ArrowLeft, Loader2,
} from "lucide-react";
import { getBlogPostById, likeBlogPost, unlikeBlogPost, type BlogPost } from "@/api/blog.api";

const getInitials = (name: string | null) => {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

export default function BlogPostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }

    const fetch = async () => {
      try {
        const data = await getBlogPostById(id);
        setPost(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleLike = async () => {
    if (!user) { toast.error("Sign in to like posts"); return; }
    if (!post) return;

    if (post.liked_by_user) {
      await unlikeBlogPost(post.id);
      setPost((p) => p ? { ...p, liked_by_user: false, likes_count: Math.max(0, p.likes_count - 1) } : p);
    } else {
      await likeBlogPost(post.id);
      setPost((p) => p ? { ...p, liked_by_user: true, likes_count: p.likes_count + 1 } : p);
    }
  };

  const handleShare = (platform: string) => {
    if (!post) return;
    const url = `${window.location.origin}/blog/${post.id}`;
    const text = `Check out "${post.title}" on ZentraGig`;
    const links: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(post.title)}`,
    };

    if (platform === "copy") {
      navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    } else {
      window.open(links[platform], "_blank", "noopener,noreferrer");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">Post not found</h1>
            <p className="text-muted-foreground">This post may have been removed or doesn't exist.</p>
            <Button onClick={() => navigate("/blog")}>Back to Blog</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Cover image */}
        {post.cover_image && (
          <div className="w-full h-64 md:h-80 overflow-hidden">
            <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="container-wide max-w-3xl mx-auto px-4 py-8">
          {/* Back */}
          <button
            onClick={() => navigate("/blog")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Blog
          </button>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-4">
            {post.title}
          </h1>

          {/* Author + date */}
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-border">
            <Avatar className="h-9 w-9">
              <AvatarImage src={post.author.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {getInitials(post.author.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{post.author.full_name || "Anonymous"}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(post.created_at), "MMMM d, yyyy")}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-wrap mb-10">
            {post.content}
          </div>

          {/* Reactions */}
          <div className="flex items-center justify-between pt-6 border-t border-border">
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                post.liked_by_user ? "text-destructive" : "text-muted-foreground hover:text-destructive"
              }`}
            >
              <Heart className={`h-5 w-5 ${post.liked_by_user ? "fill-current" : ""}`} />
              {post.likes_count} {post.likes_count === 1 ? "like" : "likes"}
            </button>

            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-2">Share</span>
              <button onClick={() => handleShare("twitter")} className="p-2 rounded-full hover:bg-muted transition-colors" title="Share on X">
                <Twitter className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => handleShare("facebook")} className="p-2 rounded-full hover:bg-muted transition-colors" title="Share on Facebook">
                <Facebook className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => handleShare("linkedin")} className="p-2 rounded-full hover:bg-muted transition-colors" title="Share on LinkedIn">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => handleShare("copy")} className="p-2 rounded-full hover:bg-muted transition-colors" title="Copy link">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
