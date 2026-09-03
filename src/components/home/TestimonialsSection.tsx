import { useState, useEffect } from "react";
import { Star, Quote } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

interface PlatformReview {
  name: string;
  role: string;
  location: string;
  avatar: string | null;
  rating: number;
  content: string;
}

interface PlatformReviewRow {
  rating: number;
  comment: string | null;
  user_id: string;
  is_featured: boolean;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
    state: string | null;
  } | null;
}

export function TestimonialsSection() {
  const [testimonials, setTestimonials] = useState<PlatformReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApprovedReviews();
  }, []);

  const fetchApprovedReviews = async () => {
    const { data } = await supabase
      .from("platform_reviews")
      .select("rating, comment, user_id, is_featured, profiles:user_id(full_name, avatar_url, city, state)")
      .eq("is_approved", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6);

    const rows = data as PlatformReviewRow[] | null;
    if (rows && rows.length >= 3) {
      const mapped: PlatformReview[] = rows
        .filter((r) => r.comment)
        .slice(0, 3)
        .map((r) => ({
          name: r.profiles?.full_name || "ZentraGig User",
          role: "Verified User",
          location: r.profiles?.state || r.profiles?.city || "Nigeria",
          avatar: r.profiles?.avatar_url || null,
          rating: r.rating,
          content: r.comment as string,
        }));
      if (mapped.length >= 3) setTestimonials(mapped);
    }
    setLoading(false);
  };

  if (loading) return null;

  return (
    <section className="section-padding">
      <div className="container-wide">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            What Our Users Say
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Join thousands of satisfied clients and freelancers across Nigeria
          </p>
        </div>

        {testimonials.length === 0 ? (
          <p className="text-center text-muted-foreground">
            Be one of our first reviewers — complete a project on ZentraGig and share your experience.
          </p>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative bg-card rounded-2xl p-8 border border-border shadow-card"
            >
              <Quote className="absolute top-6 right-6 h-8 w-8 text-primary/10" />

              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>

              <p className="text-foreground leading-relaxed mb-6">
                "{testimonial.content}"
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={testimonial.avatar || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {testimonial.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role} • {testimonial.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </section>
  );
}
