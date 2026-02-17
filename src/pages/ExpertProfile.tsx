import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MapPin, CheckCircle2, Briefcase, Clock, ArrowLeft, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatNaira } from "@/lib/nigerian-data";
import { Loader2 } from "lucide-react";

export default function ExpertProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      setLoading(true);
      const [profileRes, fpRes, portfolioRes, reviewsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase.from("freelancer_profiles").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("portfolio_items").select("*").eq("freelancer_profile_id", id),
        supabase.from("reviews").select("*, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url)").eq("reviewee_id", id).order("created_at", { ascending: false }).limit(10),
      ]);
      setProfile(profileRes.data);
      setFreelancerProfile(fpRes.data);

      // Portfolio might be linked via freelancer_profile.id, not user_id
      if (fpRes.data) {
        const { data: pData } = await supabase.from("portfolio_items").select("*").eq("freelancer_profile_id", fpRes.data.id);
        setPortfolio(pData || []);
      } else {
        setPortfolio(portfolioRes.data || []);
      }

      setReviews(reviewsRes.data || []);
      setLoading(false);
    };
    fetch();
  }, [id]);

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const availabilityLabels: Record<string, string> = {
    full_time: "Full Time",
    part_time: "Part Time",
    weekends: "Weekends Only",
    flexible: "Flexible",
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

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Expert not found.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container-wide py-8">
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column – profile card */}
            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Avatar className="h-24 w-24 mx-auto border-4 border-background shadow-lg">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <h1 className="text-xl font-bold mt-4 text-foreground">{profile.full_name}</h1>
                  {freelancerProfile?.title && (
                    <p className="text-muted-foreground">{freelancerProfile.title}</p>
                  )}
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-2">
                    <MapPin className="h-3.5 w-3.5" />
                    {profile.city && `${profile.city}, `}{profile.state || "Nigeria"}
                  </div>
                  {profile.is_verified && (
                    <Badge className="mt-3 bg-primary/10 text-primary border-primary/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                    </Badge>
                  )}

                  {user && user.id !== id && (
                    <Button className="w-full mt-4" asChild>
                      <Link to={`/messages?user=${id}`}>
                        <MessageSquare className="h-4 w-4 mr-2" /> Contact
                      </Link>
                    </Button>
                  )}
                  {!user && (
                    <Button className="w-full mt-4" asChild>
                      <Link to={`/auth?redirect=${encodeURIComponent(`/expert/${id}`)}`}>
                        Sign in to Contact
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              {freelancerProfile && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {freelancerProfile.hourly_rate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hourly Rate</span>
                        <span className="font-semibold text-primary">{formatNaira(freelancerProfile.hourly_rate)}/hr</span>
                      </div>
                    )}
                    {freelancerProfile.years_experience && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Experience</span>
                        <span className="font-medium">{freelancerProfile.years_experience} years</span>
                      </div>
                    )}
                    {freelancerProfile.availability && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Availability</span>
                        <span className="font-medium">{availabilityLabels[freelancerProfile.availability] || freelancerProfile.availability}</span>
                      </div>
                    )}
                    {freelancerProfile.total_jobs_completed != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Jobs Completed</span>
                        <span className="font-medium">{freelancerProfile.total_jobs_completed}</span>
                      </div>
                    )}
                    {freelancerProfile.rating != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rating</span>
                        <span className="font-medium flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                          {freelancerProfile.rating}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column – bio, skills, portfolio, reviews */}
            <div className="lg:col-span-2 space-y-6">
              {freelancerProfile?.bio && (
                <Card>
                  <CardHeader><CardTitle className="text-base">About</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{freelancerProfile.bio}</p>
                  </CardContent>
                </Card>
              )}

              {freelancerProfile?.skills && freelancerProfile.skills.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Skills</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {freelancerProfile.skills.map((skill: string) => (
                        <Badge key={skill} variant="secondary">{skill}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {portfolio.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Portfolio</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {portfolio.map((item) => (
                        <div key={item.id} className="border border-border rounded-lg p-4">
                          <h4 className="font-semibold text-foreground">{item.title}</h4>
                          {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
                          {item.software_used && item.software_used.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.software_used.map((s: string) => (
                                <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {reviews.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Reviews</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? "fill-accent text-accent" : "text-muted"}`} />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            by {review.reviewer?.full_name || "Client"}
                          </span>
                        </div>
                        {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
