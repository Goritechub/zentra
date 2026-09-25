import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
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
  Link as LinkIcon, ArrowLeft, Loader2, Trash2,
} from "lucide-react";
import { getBlogPostById, likeBlogPost, unlikeBlogPost, archiveBlogPost, type BlogPost } from "@/api/blog.api";
import { Skeleton } from "@/components/ui/skeleton";
import { BlogBlockRenderer } from "@/components/blog/BlogBlockRenderer";
import { estimateReadingMinutes } from "@/lib/readingTime";

const getInitials = (name: string | null) => {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

export default function BlogPostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    const frontendUrl = `${window.location.origin}/blog/${post.id}`;
    const text = `Check out "${post.title}" on ZentraGig`;
    const links: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(frontendUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(frontendUrl)}`,
      linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(frontendUrl)}&title=${encodeURIComponent(post.title)}`,
    };

    if (platform === "copy") {
      navigator.clipboard.writeText(frontendUrl);
      toast.success("Link copied!");
    } else {
      window.open(links[platform], "_blank", "noopener,noreferrer");
    }
  };

  const headings = (post?.blocks ?? [])
    .filter((b) => b.type === "h1" || b.type === "h2" || b.type === "h3")
    .map((b) => ({ id: b.id, level: b.type, text: "text" in b ? b.text : "" }));

  const isAuthor = !!user && !!post && user.id === post.author.id;
  const isAdmin = profile?.role === "admin";
  const canDelete = isAuthor || isAdmin;

  const handleDelete = async () => {
    if (!post || !window.confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await archiveBlogPost(post.id);
      toast.success("Post deleted.");
      navigate("/blog");
    } catch {
      toast.error("Failed to delete post.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          {/* Cover placeholder */}
          <Skeleton className="w-full h-64 md:h-80 rounded-none" />
          <div className="container-wide max-w-3xl mx-auto px-4 py-8">
            <Skeleton className="h-5 w-24 mb-6" />
            {/* Tags */}
            <div className="flex gap-2 mb-4">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            {/* Title */}
            <Skeleton className="h-10 w-4/5 mb-2" />
            <Skeleton className="h-10 w-3/5 mb-6" />
            {/* Author row */}
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-border">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20 ml-auto" />
            </div>
            {/* Body */}
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
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
      <SEO
        title={post.title}
        description={post.content.slice(0, 155).replace(/\n/g, " ").trim()}
        image={post.cover_image || undefined}
        type="article"
        canonicalUrl={`${window.location.origin}/blog/${post.id}`}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.content.slice(0, 155).replace(/\n/g, " ").trim(),
            image: post.cover_image || undefined,
            datePublished: post.published_at || post.created_at,
            dateModified: post.updated_at,
            author: {
              "@type": "Person",
              name: post.author.full_name || "ZentraGig",
            },
            publisher: {
              "@type": "Organization",
              name: "ZentraGig",
              sameAs: "https://zentragig.com",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Blog", item: `${window.location.origin}/blog` },
              { "@type": "ListItem", position: 2, name: post.title, item: `${window.location.origin}/blog/${post.id}` },
            ],
          },
        ]}
      />
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
            <Avatar
              className="h-9 w-9 cursor-pointer"
              onClick={() => navigate(`/blog/author/${post.author.id}`)}
            >
              <AvatarImage src={post.author.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {getInitials(post.author.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p
                className="text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate(`/blog/author/${post.author.id}`)}
              >
                {post.author.full_name || "Anonymous"}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(post.created_at), "MMMM d, yyyy")} · {estimateReadingMinutes(post.content)} min read
              </p>
            </div>
          </div>

          {/* Table of contents */}
          {headings.length > 1 && (
            <nav className="mb-8 rounded-lg border border-border p-4 text-sm">
              <p className="font-semibold text-foreground mb-2">Contents</p>
              <ul className="space-y-1.5">
                {headings.map((h) => (
                  <li
                    key={h.id}
                    className={h.level === "h1" ? "" : h.level === "h2" ? "ml-3" : "ml-6"}
                  >
                    <a href={`#${h.id}`} className="text-muted-foreground hover:text-primary transition-colors">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Content */}
          <div className="text-foreground leading-relaxed mb-10">
            <BlogBlockRenderer blocks={post.blocks} legacyContent={post.content} />
          </div>

          {/* Reactions */}
          <div className="flex items-center justify-between pt-6 border-t border-border">
            <div className="flex items-center gap-3">
              <button
                onClick={handleLike}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  post.liked_by_user ? "text-destructive" : "text-muted-foreground hover:text-destructive"
                }`}
              >
                <Heart className={`h-5 w-5 ${post.liked_by_user ? "fill-current" : ""}`} />
                {post.likes_count} {post.likes_count === 1 ? "like" : "likes"}
              </button>

              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                >
                  {deleting
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                  Delete post
                </Button>
              )}
            </div>

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
