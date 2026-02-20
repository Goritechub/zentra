import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Star, MapPin, CheckCircle2, ArrowLeft, MessageSquare, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatNaira } from "@/lib/nigerian-data";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function PortfolioCarousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) return null;
  return (
    <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden group">
      <img src={images[idx]} alt={`Portfolio image ${idx + 1}`} className="w-full h-full object-cover" />
      {images.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setIdx(i => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ExpertProfile() {
  const { id } = useParams<{ id: string }>();
  const { user, profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPortfolio, setSelectedPortfolio] = useState<any>(null);
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const [completedContract, setCompletedContract] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      setLoading(true);
      const [profileRes, fpRes, reviewsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase.from("freelancer_profiles").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("reviews").select("*, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url)").eq("reviewee_id", id).order("created_at", { ascending: false }).limit(10),
      ]);
      setProfile(profileRes.data);
      setFreelancerProfile(fpRes.data);

      if (fpRes.data) {
        const { data: pData } = await supabase.from("portfolio_items").select("*").eq("freelancer_profile_id", fpRes.data.id);
        setPortfolio(pData || []);
      }

      setReviews(reviewsRes.data || []);

      // Check if viewing client has completed a contract with this expert
      if (user && user.id !== id) {
        const { data: contractData } = await supabase
          .from("contracts")
          .select("id")
          .eq("client_id", user.id)
          .eq("freelancer_id", id)
          .eq("status", "completed")
          .limit(1);
        if (contractData && contractData.length > 0) {
          // Check if already reviewed
          const { data: existingReview } = await supabase
            .from("reviews")
            .select("id")
            .eq("contract_id", contractData[0].id)
            .eq("reviewer_id", user.id)
            .maybeSingle();
          if (!existingReview) setCompletedContract(contractData[0]);
        }
      }

      setLoading(false);
    };
    fetch();
  }, [id, user]);

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleSubmitRating = async () => {
    if (!rating || !completedContract || !user) return;
    setRatingLoading(true);
    const { error } = await supabase.from("reviews").insert({
      contract_id: completedContract.id,
      reviewer_id: user.id,
      reviewee_id: id!,
      rating,
      comment: ratingComment.trim() || null,
    });
    if (error) {
      toast.error("Failed to submit rating");
    } else {
      // Update expert's average rating
      const { data: allReviews } = await supabase.from("reviews").select("rating").eq("reviewee_id", id!);
      if (allReviews && allReviews.length > 0) {
        const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
        if (freelancerProfile?.id) {
          await supabase.from("freelancer_profiles").update({ rating: Math.round(avg * 10) / 10 }).eq("id", freelancerProfile.id);
        }
      }
      toast.success("Review submitted! Thank you.");
      setShowRateDialog(false);
      setCompletedContract(null);
      setRating(0);
      setRatingComment("");
    }
    setRatingLoading(false);
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
                        <div key={item.id} className="border border-border rounded-lg overflow-hidden">
                          {item.images?.length > 0 && (
                            <div className="aspect-video bg-muted overflow-hidden">
                              <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="p-4">
                            <h4 className="font-semibold text-foreground">{item.title}</h4>
                            {item.project_type && <p className="text-xs text-primary mt-0.5">{item.project_type}</p>}
                            {item.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}
                            {item.software_used?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {item.software_used.slice(0, 3).map((s: string) => (
                                  <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                                ))}
                              </div>
                            )}
                            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setSelectedPortfolio(item)}>
                              <Eye className="h-3.5 w-3.5 mr-1.5" /> View Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rate this expert (only for clients who completed a contract) */}
              {completedContract && user && authProfile?.role === "client" && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-foreground mb-1">You've worked together!</p>
                    <p className="text-xs text-muted-foreground mb-3">Share your experience to help other clients.</p>
                    <Button size="sm" onClick={() => setShowRateDialog(true)}>
                      <Star className="h-3.5 w-3.5 mr-1.5" /> Rate This Expert
                    </Button>
                  </CardContent>
                </Card>
              )}

              {reviews.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      Reviews
                      {freelancerProfile?.rating > 0 && (
                        <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                          <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                          {freelancerProfile.rating} avg
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
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

      {/* Portfolio Detail Dialog */}
      <Dialog open={!!selectedPortfolio} onOpenChange={() => setSelectedPortfolio(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPortfolio?.title}</DialogTitle>
            {selectedPortfolio?.project_type && (
              <DialogDescription>{selectedPortfolio.project_type}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            {selectedPortfolio?.images?.length > 0 && (
              <PortfolioCarousel images={selectedPortfolio.images} />
            )}
            {selectedPortfolio?.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedPortfolio.description}</p>
            )}
            {selectedPortfolio?.software_used?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Software Used</p>
                <div className="flex flex-wrap gap-1">
                  {selectedPortfolio.software_used.map((s: string) => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPortfolio(null)}>
              <X className="h-4 w-4 mr-1.5" /> Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate Expert Dialog */}
      <Dialog open={showRateDialog} onOpenChange={setShowRateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate {profile?.full_name}</DialogTitle>
            <DialogDescription>Share your experience working with this expert.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium mb-2">Rating</p>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseEnter={() => setHoverRating(i + 1)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(i + 1)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star className={`h-8 w-8 ${i < (hoverRating || rating) ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Review <span className="text-muted-foreground">(optional)</span></label>
              <Textarea
                placeholder="Describe your experience working with this expert..."
                rows={4}
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRateDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitRating} disabled={!rating || ratingLoading}>
              {ratingLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2" />}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

