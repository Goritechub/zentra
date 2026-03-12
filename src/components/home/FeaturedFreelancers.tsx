import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, CheckCircle2, ArrowRight } from "lucide-react";
import { formatNaira } from "@/lib/nigerian-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface FeaturedExpert {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  state: string | null;
  city: string | null;
  is_verified: boolean | null;
  title: string | null;
  rating: number | null;
  total_jobs_completed: number | null;
  hourly_rate: number | null;
  skills: string[] | null;
}

export function FeaturedFreelancers() {
  const [experts, setExperts] = useState<FeaturedExpert[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchExperts = async () => {
      const { data: fpData } = await supabase
        .from("freelancer_profiles")
        .select("user_id, title, rating, total_jobs_completed, hourly_rate, skills")
        .order("rating", { ascending: false, nullsFirst: false })
        .limit(4);

      if (!fpData || fpData.length === 0) {
        setLoading(false);
        return;
      }

      const userIds = fpData.map((fp) => fp.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, state, city, is_verified")
        .in("id", userIds);

      const merged: FeaturedExpert[] = fpData.map((fp) => {
        const p = profiles?.find((pr) => pr.id === fp.user_id);
        return {
          id: fp.user_id,
          full_name: p?.full_name || null,
          avatar_url: p?.avatar_url || null,
          state: p?.state || null,
          city: p?.city || null,
          is_verified: p?.is_verified || null,
          title: fp.title,
          rating: fp.rating,
          total_jobs_completed: fp.total_jobs_completed,
          hourly_rate: fp.hourly_rate,
          skills: fp.skills,
        };
      });

      setExperts(merged);
      setLoading(false);
    };
    fetchExperts();
  }, []);

  const handleCardClick = (expertId: string) => {
    if (user) {
      navigate(`/expert/${expertId}`);
    } else {
      navigate(`/auth?redirect=${encodeURIComponent(`/expert/${expertId}`)}`);
    }
  };

  if (loading || experts.length === 0) return null;

  return (
    <section className="section-padding bg-muted/30">
      <div className="container-wide">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Featured Engineers
            </h2>
            <p className="text-muted-foreground text-lg">
              Top-rated professionals ready to work on your project
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to={user ? "/freelancers" : "/auth?redirect=%2Ffreelancers"}>
              View All Experts
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {experts.map((expert) => (
            <div
              key={expert.id}
              onClick={() => handleCardClick(expert.id)}
              className="group bg-card rounded-xl border border-border p-6 card-hover cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <Avatar className="h-16 w-16 border-2 border-background shadow-lg">
                  <AvatarImage src={expert.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                    {expert.full_name?.split(" ").map((n) => n[0]).join("") || "U"}
                  </AvatarFallback>
                </Avatar>
                {expert.is_verified && (
                  <div className="verified-badge">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </div>
                )}
              </div>

              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                <Link to={user ? `/expert/${expert.id}/profile` : `/auth?redirect=${encodeURIComponent(`/expert/${expert.id}/profile`)}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                  {expert.full_name || "Expert"}
                </Link>
              </h3>
              {expert.title && (
                <p className="text-sm text-muted-foreground mt-1">{expert.title}</p>
              )}

              {(expert.city || expert.state) && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                  <MapPin className="h-3.5 w-3.5" />
                  {expert.city && `${expert.city}, `}{expert.state || "Global"}
                </div>
              )}

              {expert.rating != null && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-accent text-accent" />
                    <span className="font-semibold text-foreground">{expert.rating}</span>
                  </div>
                  {expert.total_jobs_completed != null && (
                    <span className="text-sm text-muted-foreground">
                      ({expert.total_jobs_completed} jobs)
                    </span>
                  )}
                </div>
              )}

              {expert.skills && expert.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {expert.skills.slice(0, 3).map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs font-medium">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}

              {expert.hourly_rate != null && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">Starting at</p>
                  <p className="text-lg font-bold text-primary">
                    {formatNaira(expert.hourly_rate)}<span className="text-sm font-normal text-muted-foreground">/hr</span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
