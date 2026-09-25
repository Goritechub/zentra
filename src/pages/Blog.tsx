import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Search,
  PenLine,
  Heart,
  Clock,
  Twitter,
  Facebook,
  Linkedin,
  Link as LinkIcon,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { BlogCardSkeleton } from "@/components/skeletons/BlogCardSkeleton";
import {
  getBlogPosts,
  getBlogTagFacets,
  likeBlogPost,
  unlikeBlogPost,
  type BlogPost,
} from "@/api/blog.api";
import { blogCategories, getBlogCategoryBySlug } from "@/lib/blogCategories";
import { estimateReadingMinutes } from "@/lib/readingTime";

const POSTS_PER_PAGE = 9;

const Blog = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { slug: categorySlugParam } = useParams<{ slug?: string }>();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categorySlugParam || null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [tagFacets, setTagFacets] = useState<{ tag: string; count: number }[]>([]);

  // Keep local state in sync with the :slug route param (e.g. browser back/forward,
  // or landing directly on /blog/category/:slug).
  useEffect(() => {
    setSelectedCategory(categorySlugParam ? getBlogCategoryBySlug(categorySlugParam)?.slug ?? null : null);
    setPage(1);
  }, [categorySlugParam]);

  const selectCategory = (slug: string | null) => {
    setSelectedCategory(slug);
    setPage(1);
    navigate(slug ? `/blog/category/${slug}` : "/blog");
  };

  useEffect(() => {
    getBlogTagFacets()
      .then(({ tags }) => setTagFacets(tags))
      .catch(() => {});
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { posts: data, total } = await getBlogPosts(
        page,
        search || undefined,
        selectedTag || undefined,
        selectedCategory || undefined,
      );
      setPosts(data);
      setTotalCount(total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedTag, selectedCategory]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleLike = async (postId: string) => {
    if (!user) {
      toast.error("Sign in to like posts");
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    if (post.liked_by_user) {
      await unlikeBlogPost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked_by_user: false,
                likes_count: Math.max(0, p.likes_count - 1),
              }
            : p,
        ),
      );
    } else {
      await likeBlogPost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked_by_user: true, likes_count: p.likes_count + 1 }
            : p,
        ),
      );
    }
  };

  const handleShare = (post: BlogPost, platform: string) => {
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

  const totalPages = Math.ceil(totalCount / POSTS_PER_PAGE);

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={selectedCategory ? getBlogCategoryBySlug(selectedCategory)?.name || "Blog" : "Blog"}
        description="Insights, tips, and stories from our community of experts and clients."
        canonicalUrl={`${window.location.origin}${window.location.pathname}`}
      />
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-12 md:py-16">
          <div className="container-wide max-w-5xl mx-auto text-center px-4">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              ZentraGig Blog
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto mb-6">
              Insights, tips, and stories from our community of experts and
              clients.
            </p>
            <div className="flex items-center gap-3 max-w-lg mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              {user && (
                <Button className="gap-2 shrink-0" onClick={() => navigate("/blog/write")}>
                  <PenLine className="h-4 w-4" /> Write
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Tags */}
        {tagFacets.length > 0 && (
          <div className="container-wide max-w-5xl mx-auto px-4 py-4 flex flex-wrap gap-2">
            <Badge
              variant={selectedTag === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => {
                setSelectedTag(null);
                setPage(1);
              }}
            >
              All
            </Badge>
            {tagFacets.map(({ tag, count }) => (
              <Badge
                key={tag}
                variant={selectedTag === tag ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedTag(tag);
                  setPage(1);
                }}
              >
                {tag} ({count})
              </Badge>
            ))}
          </div>
        )}

        {/* Categories */}
        <div className="container-wide max-w-5xl mx-auto px-4 py-2 flex flex-wrap gap-2">
          <Badge
            variant={selectedCategory === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => selectCategory(null)}
          >
            All Categories
          </Badge>
          {blogCategories.map((cat) => (
            <Badge
              key={cat.slug}
              variant={selectedCategory === cat.slug ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => selectCategory(cat.slug)}
            >
              {cat.name}
            </Badge>
          ))}
        </div>

        {/* Posts Grid */}
        <section className="container-wide max-w-5xl mx-auto px-4 py-8">
          {loading ? (
            <BlogCardSkeleton count={6} />
          ) : posts.length === 0 ? (
            <EmptyState
              variant="documents"
              title="No posts yet"
              description="Be the first to share something!"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <Card
                  key={post.id}
                  className="group overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Cover — click navigates to full post */}
                  <div
                    className="h-40 bg-muted relative overflow-hidden cursor-pointer"
                    onClick={() => navigate(`/blog/${post.id}`)}
                  >
                    {post.cover_image ? (
                      <img
                        src={post.cover_image}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                        <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-3">
                    {/* Tags */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {post.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <h3
                      className="font-semibold text-foreground line-clamp-2 leading-tight cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigate(`/blog/${post.id}`)}
                    >
                      {post.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {post.content}
                    </p>

                    {/* Author + date */}
                    <div className="flex items-center gap-2 pt-1">
                      <Avatar
                        className="h-6 w-6 cursor-pointer"
                        onClick={() => navigate(`/blog/author/${post.author.id}`)}
                      >
                        <AvatarImage
                          src={post.author.avatar_url || undefined}
                        />
                        <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                          {getInitials(post.author.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className="text-xs text-muted-foreground truncate cursor-pointer hover:text-primary transition-colors"
                        onClick={() => navigate(`/blog/author/${post.author.id}`)}
                      >
                        {post.author.full_name || "Anonymous"}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(post.created_at), "MMM d")} · {estimateReadingMinutes(post.content)} min read
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <button
                        onClick={() => handleLike(post.id)}
                        className={`flex items-center gap-1 text-sm transition-colors ${post.liked_by_user ? "text-destructive" : "text-muted-foreground hover:text-destructive"}`}
                      >
                        <Heart
                          className={`h-4 w-4 ${post.liked_by_user ? "fill-current" : ""}`}
                        />
                        {post.likes_count}
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleShare(post, "twitter")}
                          className="p-1.5 rounded-full hover:bg-muted transition-colors"
                          title="Share on X"
                        >
                          <Twitter className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleShare(post, "facebook")}
                          className="p-1.5 rounded-full hover:bg-muted transition-colors"
                          title="Share on Facebook"
                        >
                          <Facebook className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleShare(post, "linkedin")}
                          className="p-1.5 rounded-full hover:bg-muted transition-colors"
                          title="Share on LinkedIn"
                        >
                          <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleShare(post, "copy")}
                          className="p-1.5 rounded-full hover:bg-muted transition-colors"
                          title="Copy link"
                        >
                          <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
