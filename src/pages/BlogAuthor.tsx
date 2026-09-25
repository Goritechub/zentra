import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Clock, Image as ImageIcon, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { BlogCardSkeleton } from "@/components/skeletons/BlogCardSkeleton";
import { getBlogPosts, type BlogPost, type BlogAuthor as BlogAuthorInfo } from "@/api/blog.api";
import { estimateReadingMinutes } from "@/lib/readingTime";

const POSTS_PER_PAGE = 9;

const getInitials = (name: string | null) => {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

const BlogAuthor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [author, setAuthor] = useState<BlogAuthorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPosts = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { posts: data, total } = await getBlogPosts(page, undefined, undefined, undefined, id);
      setPosts(data);
      setTotalCount(total);
      if (data.length > 0) setAuthor(data[0].author);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, page]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const totalPages = Math.ceil(totalCount / POSTS_PER_PAGE);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={author?.full_name ? `${author.full_name} · Blog` : "Author"}
        description={author?.full_name ? `Posts by ${author.full_name} on the ZentraGig blog.` : undefined}
      />
      <Header />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-12 md:py-16">
          <div className="container-wide max-w-5xl mx-auto text-center px-4">
            <button
              onClick={() => navigate("/blog")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 mx-auto"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Blog
            </button>
            {author && (
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={author.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {getInitials(author.full_name)}
                  </AvatarFallback>
                </Avatar>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {author.full_name || "Anonymous"}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {totalCount} {totalCount === 1 ? "post" : "posts"}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="container-wide max-w-5xl mx-auto px-4 py-8">
          {loading ? (
            <BlogCardSkeleton count={6} />
          ) : posts.length === 0 ? (
            <EmptyState
              variant="documents"
              title="No posts yet"
              description="This author hasn't published anything yet."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <Card
                  key={post.id}
                  className="group overflow-hidden hover:shadow-lg transition-shadow"
                >
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
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {post.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
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
                    <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(post.created_at), "MMM d")} · {estimateReadingMinutes(post.content)} min read
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

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

export default BlogAuthor;
