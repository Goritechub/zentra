import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, Star, Briefcase, Trophy, Calendar, Settings,
  ArrowLeft, MessageSquare, CheckCircle2,
} from "lucide-react";
import { getClientProfileOverview } from "@/api/client-read.api";
import { useAuth } from "@/hooks/useAuth";
import { VerificationBadges } from "@/components/VerificationBadges";
import { formatNaira } from "@/lib/nigerian-data";

function getInitials(name: string | null) {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function RatingStars({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
      <span className="text-sm font-medium">{rating > 0 ? rating.toFixed(1) : "0.0"}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
}

function memberSince(createdAt: string) {
  return new Date(createdAt).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}

export default function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const isOwner = user?.id === id;

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getClientProfileOverview(id);
        if (cancelled) return;
        setData(res.data);
      } catch {
        if (cancelled) return;
        setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const profile = data?.profile;
  const kyc = data?.kyc;
  const jobs: any[] = data?.jobs || [];
  const contests: any[] = data?.contests || [];
  const reviews: any[] = data?.reviews || [];
  const stats = data?.stats || { totalJobs: 0, completedJobs: 0, totalContests: 0 };

  const avgRating = reviews.length
    ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container-wide py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <Card><CardContent className="pt-6 space-y-4">
                <Skeleton className="h-24 w-24 rounded-full mx-auto" />
                <Skeleton className="h-6 w-48 mx-auto" />
                <Skeleton className="h-4 w-32 mx-auto" />
              </CardContent></Card>
            </div>
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container-wide py-16 text-center">
          <p className="text-muted-foreground text-lg">Client not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const isVerified = kyc?.kyc_status === "verified";
  const isZentraVerified = kyc?.zentra_verified === true;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container-wide py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Sidebar ── */}
          <aside className="lg:col-span-1 space-y-5">
            {/* Profile card */}
            <Card>
              <CardContent className="pt-6 pb-5 text-center space-y-4">
                <Avatar className="h-24 w-24 mx-auto">
                  <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <h1 className="text-xl font-bold text-foreground">{profile.full_name || "Client"}</h1>
                  {profile.username && (
                    <p className="text-sm text-muted-foreground mt-0.5">@{profile.username}</p>
                  )}
                  <Badge variant="outline" className="mt-2 text-xs capitalize">Client</Badge>
                </div>

                <VerificationBadges
                  isVerified={isVerified}
                  isZentraVerified={isZentraVerified}
                  role="client"
                  className="justify-center"
                />

                {(profile.state || profile.city) && (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {[profile.city, profile.state].filter(Boolean).join(", ")}
                  </p>
                )}

                {profile.created_at && (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Member since {memberSince(profile.created_at)}
                  </p>
                )}

                {isOwner && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link to="/my-profile">
                      <Settings className="h-3.5 w-3.5 mr-1.5" /> Edit Profile
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> Jobs Posted
                  </span>
                  <span className="font-medium">{stats.totalJobs}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                  </span>
                  <span className="font-medium">{stats.completedJobs}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5" /> Contests
                  </span>
                  <span className="font-medium">{stats.totalContests}</span>
                </div>
                {reviews.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <RatingStars rating={avgRating} count={reviews.length} />
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* ── Main content ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Jobs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Briefcase className="h-4 w-4" /> Posted Jobs
                  <Badge variant="secondary" className="ml-auto">{jobs.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No public jobs yet.</p>
                ) : (
                  <div className="space-y-3">
                    {jobs.map((job: any) => (
                      <Link
                        key={job.id}
                        to={`/jobs/${job.id}`}
                        className="block p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{job.title}</p>
                            {job.category && (
                              <p className="text-xs text-muted-foreground mt-0.5">{job.category}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize ${
                                job.status === "completed"
                                  ? "border-green-500/40 text-green-600"
                                  : job.status === "in_progress"
                                    ? "border-primary/40 text-primary"
                                    : "border-border"
                              }`}
                            >
                              {job.status?.replace("_", " ")}
                            </Badge>
                          </div>
                        </div>
                        {(job.budget_min || job.budget_max) && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Budget:{" "}
                            {job.budget_type === "fixed"
                              ? formatNaira(job.budget_max || job.budget_min)
                              : `${formatNaira(job.budget_min)} – ${formatNaira(job.budget_max)}/hr`}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contests */}
            {contests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-4 w-4" /> Contests
                    <Badge variant="secondary" className="ml-auto">{contests.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {contests.map((contest: any) => (
                      <Link
                        key={contest.id}
                        to={`/contests/${contest.id}`}
                        className="block p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{contest.title}</p>
                            {contest.category && (
                              <p className="text-xs text-muted-foreground mt-0.5">{contest.category}</p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize shrink-0 ${
                              contest.status === "completed"
                                ? "border-green-500/40 text-green-600"
                                : contest.status === "active"
                                  ? "border-primary/40 text-primary"
                                  : "border-border"
                            }`}
                          >
                            {contest.status?.replace("_", " ")}
                          </Badge>
                        </div>
                        {contest.budget && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Prize pool: {formatNaira(contest.budget)}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reviews received */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" /> Reviews
                  {reviews.length > 0 && (
                    <span className="ml-2">
                      <RatingStars rating={avgRating} count={reviews.length} />
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No reviews yet.</p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review: any) => {
                      const reviewer = review.reviewer as any;
                      const reviewerHref =
                        reviewer?.role === "client"
                          ? `/client/${reviewer?.id}/profile`
                          : `/expert/${reviewer?.id}/profile`;
                      return (
                        <div key={review.id} className="p-4 rounded-lg bg-muted/40 border border-border space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={reviewer?.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {getInitials(reviewer?.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <Link
                                  to={reviewerHref}
                                  className="text-sm font-medium hover:underline text-foreground"
                                >
                                  {reviewer?.full_name || "Expert"}
                                </Link>
                                {reviewer?.username && (
                                  <Link
                                    to={reviewerHref}
                                    className="block text-xs text-muted-foreground hover:text-primary"
                                  >
                                    @{reviewer.username}
                                  </Link>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3.5 w-3.5 ${i < Math.round(review.rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                                />
                              ))}
                            </div>
                          </div>
                          {review.comment && (
                            <p className="text-sm text-muted-foreground">{review.comment}</p>
                          )}
                          {(review.contract as any)?.job_title && (
                            <p className="text-xs text-muted-foreground">
                              Re: {(review.contract as any).job_title}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
