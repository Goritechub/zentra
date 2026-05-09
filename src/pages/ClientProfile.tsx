import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Settings, ArrowLeft, Pencil } from "lucide-react";
import { getClientProfileOverview } from "@/api/client-read.api";
import { useAuth } from "@/hooks/useAuth";
import { VerificationBadges } from "@/components/VerificationBadges";
import { StatusBadge } from "@/components/StatusBadge";
import { useCurrency } from "@/hooks/useCurrency";
import { getCategoryByName } from "@/lib/categories";

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
            className={`h-3.5 w-3.5 ${
              i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
            }`}
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

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {right && <span>{right}</span>}
    </div>
  );
}

function ContestVisual({ contest }: { contest: any }) {
  if (contest.banner_image) {
    return (
      <div className="aspect-video w-full overflow-hidden">
        <img
          src={contest.banner_image}
          alt={contest.title}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  const cat = contest.category ? getCategoryByName(contest.category) : null;
  const gradient = cat?.color || "from-zinc-500 to-zinc-600";
  return (
    <div className={`h-14 bg-gradient-to-r ${gradient} flex items-end px-4 pb-2`}>
      {contest.category && (
        <span className="text-[11px] font-medium text-white/80 uppercase tracking-wide">
          {contest.category}
        </span>
      )}
    </div>
  );
}

export default function ClientProfile() {
  const { format } = useCurrency();
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
            <div className="lg:col-span-1">
              <Card className="rounded-2xl border-border/60">
                <CardContent className="pt-8 pb-6 text-center space-y-4">
                  <Skeleton className="h-24 w-24 rounded-full mx-auto" />
                  <Skeleton className="h-7 w-40 mx-auto" />
                  <Skeleton className="h-3 w-24 mx-auto" />
                  <div className="grid grid-cols-3 gap-2 pt-5 mt-2 border-t border-border/60">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="space-y-1.5">
                        <Skeleton className="h-6 w-8 mx-auto" />
                        <Skeleton className="h-2.5 w-14 mx-auto" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2 space-y-5">
              <Skeleton className="h-52 w-full rounded-2xl" />
              <Skeleton className="h-52 w-full rounded-2xl" />
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
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const since = profile.created_at ? `Member since ${memberSince(profile.created_at)}` : null;
  const metaLine = [location, since].filter(Boolean).join(" · ");

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
          <aside className="lg:col-span-1">
            <Card className="rounded-2xl border-border/60">
              <CardContent className="pt-8 pb-6 text-center">

                <div className="relative mx-auto w-fit">
                  <Avatar className="h-24 w-24 ring-2 ring-border/60 ring-offset-2 ring-offset-background">
                    <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  {isOwner && (
                    <Link
                      to="/settings?tab=profile"
                      className="absolute bottom-0 right-0 flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-md border-2 border-background hover:bg-primary/90 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>

                <h1 className="text-2xl font-bold text-foreground mt-4 leading-tight">
                  {profile.full_name || "Client"}
                </h1>
                {profile.username && (
                  <Link
                    to={`/client/${profile.id}/profile`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-0.5 block"
                  >
                    @{profile.username}
                  </Link>
                )}

                <div className="mt-3">
                  <VerificationBadges
                    isVerified={isVerified}
                    isZentraVerified={isZentraVerified}
                    role="client"
                    className="justify-center"
                  />
                </div>

                {metaLine && (
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{metaLine}</p>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-border/60">
                  <div>
                    <p className="text-xl font-bold text-foreground">{stats.totalJobs}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Jobs Posted</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{stats.completedJobs}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Completed</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{stats.totalContests}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Contests</p>
                  </div>
                </div>

                {reviews.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/60 flex justify-center">
                    <RatingStars rating={avgRating} count={reviews.length} />
                  </div>
                )}

                {isOwner && (
                  <Button variant="outline" size="sm" className="w-full mt-5 rounded-xl" asChild>
                    <Link to="/settings">
                      <Settings className="h-3.5 w-3.5 mr-1.5" /> Account Settings
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* ── Main content ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Jobs */}
            <Card className="rounded-2xl border-border/60 overflow-hidden">
              <SectionHeader
                label="Posted Jobs"
                right={
                  <span className="text-xs text-muted-foreground">{jobs.length}</span>
                }
              />
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No public jobs yet.
                </p>
              ) : (
                <div className="divide-y divide-border/60">
                  {jobs.map((job: any) => (
                    <Link
                      key={job.id}
                      to={`/jobs/${job.id}`}
                      className="flex flex-col px-6 py-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="font-semibold text-sm text-foreground leading-snug">
                          {job.title}
                        </p>
                        <StatusBadge status={job.status} className="shrink-0 mt-0.5" />
                      </div>
                      {job.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {job.description}
                        </p>
                      )}
                      <div className="flex items-center text-xs text-muted-foreground mt-auto pt-1">
                        {(job.budget_min || job.budget_max) && (
                          <span>
                            {!job.is_hourly
                              ? format(job.budget_max || job.budget_min)
                              : `${format(job.budget_min)} – ${format(job.budget_max)}/hr`}
                          </span>
                        )}
                        {job.created_at && (
                          <span className="ml-auto">
                            {new Date(job.created_at).toLocaleDateString("en-NG", {
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Contests */}
            {contests.length > 0 && (
              <Card className="rounded-2xl border-border/60 overflow-hidden">
                <SectionHeader
                  label="Contests"
                  right={
                    <span className="text-xs text-muted-foreground">{contests.length}</span>
                  }
                />
                <div className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {contests.map((contest: any) => {
                      const total =
                        (contest.prize_first || 0) +
                        (contest.prize_second || 0) +
                        (contest.prize_third || 0) +
                        (contest.prize_fourth || 0) +
                        (contest.prize_fifth || 0);
                      return (
                        <Link
                          key={contest.id}
                          to={`/contests/${contest.id}`}
                          className="block rounded-xl border border-border/60 hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5 transition-all overflow-hidden"
                        >
                          <ContestVisual contest={contest} />
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-semibold text-sm text-foreground leading-snug line-clamp-2">
                                {contest.title}
                              </p>
                              <StatusBadge status={contest.status} className="shrink-0 mt-0.5" />
                            </div>
                            {total > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Prize pool: {format(total)}
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* Reviews */}
            <Card className="rounded-2xl border-border/60 overflow-hidden">
              <SectionHeader
                label="Reviews"
                right={reviews.length > 0 ? <RatingStars rating={avgRating} count={reviews.length} /> : undefined}
              />
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No reviews yet.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {reviews.map((review: any) => {
                    const reviewer = review.reviewer as any;
                    const reviewerHref =
                      reviewer?.role === "client"
                        ? `/client/${reviewer?.id}/profile`
                        : `/expert/${reviewer?.id}/profile`;
                    return (
                      <div key={review.id} className="px-6 py-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={reviewer?.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getInitials(reviewer?.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Link
                                to={reviewerHref}
                                className="text-sm font-medium hover:underline text-foreground leading-tight block"
                              >
                                {reviewer?.full_name || "Expert"}
                              </Link>
                              {reviewer?.username && (
                                <Link
                                  to={reviewerHref}
                                  className="text-xs text-muted-foreground hover:text-primary"
                                >
                                  @{reviewer.username}
                                </Link>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${
                                  i < Math.round(review.rating || 0)
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-muted-foreground">{review.comment}</p>
                        )}
                        {(review.contract as any)?.job_title && (
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            Re: {(review.contract as any).job_title}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
