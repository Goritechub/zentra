import { useEffect, useState, useRef } from "react";
import { SEO } from "@/components/SEO";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Star, ArrowLeft, ChevronLeft, ChevronRight, X,
  Send, Award, Settings, Share2, Download, Link as LinkIcon,
  Image, Clock, Pencil, Copy, Check,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getExpertProfileOverview } from "@/api/expert-read.api";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "sonner";
import { VerificationBadges } from "@/components/VerificationBadges";
import { StatusBadge } from "@/components/StatusBadge";
import { KycVerificationCard } from "@/components/KycVerificationCard";
import { useKycVerification } from "@/hooks/useKycVerification";
import { getReferralInfo } from "@/api/auth.api";
import { NetworkError } from "@/components/NetworkError";
import { logError } from "@/lib/error-utils";
import html2canvas from "html2canvas";
import type {
  ExpertProfileInfo,
  ExpertKycInfo,
  ExpertFreelancerProfile,
  ExpertPortfolioItem,
  ExpertReview,
  ExpertPastContract,
  ExpertCertification,
  ExpertWorkExperience,
  ExpertServiceOffer,
} from "@/types/expert";

// ── helpers ────────────────────────────────────────────────────────────────────

function formatResponseTime(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "N/A";
  if (hours < 1) return "< 1 hr";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

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
            className={`h-3.5 w-3.5 ${i < Math.round(rating) ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
      <span className="text-sm font-medium">{rating > 0 ? rating.toFixed(1) : "0.0"}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
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

// ── sub-components ─────────────────────────────────────────────────────────────

function PortfolioCarousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) return null;
  return (
    <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden group">
      <img src={images[idx]} alt={`Portfolio image ${idx + 1}`} className="w-full h-full object-cover" />
      {images.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ContractsCarousel({ contracts }: { contracts: ExpertPastContract[] }) {
  const [idx, setIdx] = useState(0);
  if (!contracts || contracts.length === 0) return null;
  const c = contracts[idx];
  return (
    <div>
      <div className="px-6 py-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-foreground leading-snug">
              {c.job_title || "Untitled Contract"}
            </h4>
            {c.job_category && <p className="text-xs text-primary mt-0.5">{c.job_category}</p>}
          </div>
          <StatusBadge status={c.status} className="shrink-0 mt-0.5" />
        </div>
        {c.job_description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{c.job_description}</p>
        )}
        <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
          {c.started_at && (
            <span>
              Started{" "}
              {new Date(c.started_at).toLocaleDateString("en-NG", { month: "short", year: "numeric" })}
            </span>
          )}
          {c.completed_at && (
            <span>
              Completed{" "}
              {new Date(c.completed_at).toLocaleDateString("en-NG", { month: "short", year: "numeric" })}
            </span>
          )}
        </div>
        {c.review && (
          <div className="pt-3 border-t border-border/60">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${i < c.review.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">by {c.review.reviewer_name || "Client"}</span>
            </div>
            {c.review.comment && (
              <p className="text-xs text-muted-foreground mt-1">{c.review.comment}</p>
            )}
          </div>
        )}
      </div>
      {contracts.length > 1 && (
        <div className="px-6 pb-4 flex items-center justify-center gap-3">
          <button
            onClick={() => setIdx((i) => (i - 1 + contracts.length) % contracts.length)}
            className="p-1.5 rounded-full border border-border/60 hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">{idx + 1} / {contracts.length}</span>
          <button
            onClick={() => setIdx((i) => (i + 1) % contracts.length)}
            className="p-1.5 rounded-full border border-border/60 hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────────

const availabilityLabels: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  weekends: "Weekends Only",
  flexible: "Flexible",
};

export default function ExpertProfile() {
  const { format } = useCurrency();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile: authProfile } = useAuth();

  const [profile, setProfile] = useState<ExpertProfileInfo | null>(null);
  const [responseKyc, setResponseKyc] = useState<ExpertKycInfo | null>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<ExpertFreelancerProfile | null>(null);
  const [portfolio, setPortfolio] = useState<ExpertPortfolioItem[]>([]);
  const [reviews, setReviews] = useState<ExpertReview[]>([]);
  const [pastContracts, setPastContracts] = useState<ExpertPastContract[]>([]);
  const [certifications, setCertifications] = useState<ExpertCertification[]>([]);
  const [workExperience, setWorkExperience] = useState<ExpertWorkExperience[]>([]);
  const [completedContractCount, setCompletedContractCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedPortfolio, setSelectedPortfolio] = useState<ExpertPortfolioItem | null>(null);
  const [services, setServices] = useState<ExpertServiceOffer[]>([]);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const isOwner = user?.id === id;

  const referralQuery = useQuery({
    queryKey: ["referral-info", id],
    enabled: isOwner,
    staleTime: 5 * 60 * 1000,
    queryFn: getReferralInfo,
  });
  const isClient = authProfile?.role === "client";

  const { isVerified: ownerKycVerified, isZentraVerified: ownerZentraVerified } = useKycVerification(
    isOwner ? id : undefined,
  );

  const kycVerified = isOwner
    ? ownerKycVerified
    : responseKyc?.kyc_status === "verified" || profile?.is_verified;
  const isZentraVerified = isOwner ? ownerZentraVerified : responseKyc?.zentra_verified === true;

  const dynamicRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
      : 0;

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let cancelled = false;
    setFetchError(null);
    (async () => {
      if (!cancelled) setLoading(true);
      try {
        const response = await getExpertProfileOverview(id);
        if (cancelled) return;
        setProfile(response.data.profile || null);
        setResponseKyc(response.data.kyc || null);
        setFreelancerProfile(response.data.freelancerProfile || null);
        setCertifications(response.data.certifications || []);
        setWorkExperience(response.data.workExperience || []);
        setServices(response.data.services || []);
        setPortfolio(response.data.portfolio || []);
        setPastContracts(response.data.pastContracts || []);
        setCompletedContractCount(response.data.completedContractCount || 0);
        setReviews(response.data.reviews || []);
      } catch (err) {
        if (cancelled) return;
        logError("ExpertProfile", err);
        setFetchError(err instanceof Error ? err : new Error("Failed to load profile"));
        setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, retryKey]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/expert/${id}/profile`);
    toast.success("Profile link copied!");
    setShowShareMenu(false);
  };

  const handleCopyReferral = () => {
    const url = referralQuery.data?.share_url;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedReferral(true);
      setShowShareMenu(false);
      setTimeout(() => setCopiedReferral(false), 2000);
    });
  };

  const handleExportImage = async () => {
    if (!profileRef.current) return;
    toast.info("Generating image...");
    try {
      const canvas = await html2canvas(profileRef.current, { useCORS: true, scale: 2 });
      const link = document.createElement("a");
      link.download = `${profile?.full_name || "expert"}-profile.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Image downloaded!");
    } catch { toast.error("Failed to generate image"); }
    setShowShareMenu(false);
  };

  const handleExportPDF = async () => {
    if (!profileRef.current) return;
    toast.info("Generating PDF...");
    try {
      const canvas = await html2canvas(profileRef.current, { useCORS: true, scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(
          `<html><head><title>${profile?.full_name || "Expert"} Profile</title>` +
          `<style>body{margin:0;display:flex;justify-content:center;}img{max-width:100%;height:auto;}</style>` +
          `</head><body><img src="${imgData}" /></body></html>`,
        );
        win.document.close();
        setTimeout(() => { win.print(); }, 500);
      }
    } catch { toast.error("Failed to generate PDF"); }
    setShowShareMenu(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container-wide py-8">
          <Skeleton className="h-7 w-14 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-5">
              <Card className="rounded-2xl border-border/60">
                <CardContent className="pt-8 pb-6 text-center space-y-3">
                  <Skeleton className="h-24 w-24 rounded-full mx-auto" />
                  <Skeleton className="h-7 w-40 mx-auto" />
                  <Skeleton className="h-3 w-24 mx-auto" />
                  <div className="grid grid-cols-3 gap-2 pt-5 mt-2 border-t border-border/60">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="space-y-1.5">
                        <Skeleton className="h-6 w-8 mx-auto" />
                        <Skeleton className="h-2.5 w-12 mx-auto" />
                      </div>
                    ))}
                  </div>
                  <Skeleton className="h-9 w-full mt-2" />
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
            <div className="lg:col-span-2 space-y-5">
              <Skeleton className="h-60 w-full rounded-2xl" />
              <Skeleton className="h-44 w-full rounded-2xl" />
              <Skeleton className="h-36 w-full rounded-2xl" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <NetworkError
            error={fetchError}
            title={fetchError ? undefined : "Expert not found."}
            message={fetchError ? undefined : "This profile may no longer be available."}
            onRetry={() => setRetryKey((k) => k + 1)}
            className="max-w-md w-full border-0 bg-transparent"
          />
        </main>
        <Footer />
      </div>
    );
  }

  const isAvailable = !!freelancerProfile?.availability;
  const responseTimeHours = freelancerProfile?.avg_response_time_hours ?? null;
  const location = [profile.city, profile.state].filter(Boolean).join(", ");

  const hasContent =
    freelancerProfile?.bio ||
    (freelancerProfile?.skills?.length || 0) > 0 ||
    services.length > 0 ||
    certifications.length > 0 ||
    workExperience.length > 0 ||
    portfolio.length > 0 ||
    pastContracts.length > 0;

  const occupation = profile.occupation || freelancerProfile?.title || "Technical Expert";
  const skills = (freelancerProfile?.skills as string[] | undefined)?.slice(0, 4).join(", ");
  const seoDescription = freelancerProfile?.bio
    ? freelancerProfile.bio.slice(0, 155) + "…"
    : `${profile.full_name} is a verified ${occupation}${skills ? ` skilled in ${skills}` : ""} available for hire on ZentraGig.`;

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title={`${profile.full_name} | ${occupation}`}
        description={seoDescription}
        image={profile.avatar_url || undefined}
        type="profile"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          mainEntity: {
            "@type": "Person",
            name: profile.full_name,
            jobTitle: occupation,
            description: freelancerProfile?.bio || seoDescription,
            image: profile.avatar_url || undefined,
            url: `https://zentragig.com/expert/${profile.id}/profile`,
            knowsAbout: (freelancerProfile?.skills as string[] | undefined) || [],
            worksFor: { "@type": "Organization", name: "ZentraGig", url: "https://zentragig.com" },
          },
        }}
      />
      <Header />
      <main className="flex-1">
        <div className="container-wide py-8" ref={profileRef}>

          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {isOwner && (
              <div className="relative">
                <Button variant="outline" size="sm" onClick={() => setShowShareMenu(!showShareMenu)}>
                  <Share2 className="h-4 w-4 mr-2" /> Share / Export
                </Button>
                {showShareMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-popover border border-border/60 rounded-xl shadow-lg z-50 w-48 overflow-hidden">
                    <button
                      onClick={handleCopyLink}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <LinkIcon className="h-4 w-4" /> Copy Link
                    </button>
                    {referralQuery.data?.share_url && (
                      <button
                        onClick={handleCopyReferral}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2"
                      >
                        {copiedReferral ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                        {copiedReferral ? "Copied!" : "Copy Referral Link"}
                      </button>
                    )}
                    <button
                      onClick={handleExportImage}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <Image className="h-4 w-4" /> Download Image
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" /> Print / PDF
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Sidebar (1/3) ─────────────────────────────────────────── */}
            <aside className="lg:col-span-1 space-y-5">

              {/* Identity card */}
              <Card className="rounded-2xl border-border/60">
                <CardContent className="pt-8 pb-6 text-center">
                  <div className="relative mx-auto w-fit">
                    <Avatar className="h-24 w-24 ring-2 ring-border/60 ring-offset-2 ring-offset-background">
                      <AvatarImage src={profile.avatar_url || undefined} />
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
                    {profile.full_name}
                  </h1>

                  {isAvailable && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success mt-1.5">
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                      </span>
                      Available Now
                    </span>
                  )}

                  {profile.username && (
                    <Link
                      to={`/expert/${profile.id}/profile`}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-0.5 block"
                    >
                      @{profile.username}
                    </Link>
                  )}

                  {(freelancerProfile?.title || profile.occupation) && (
                    <p className="text-sm text-muted-foreground font-medium mt-0.5">
                      {freelancerProfile?.title || profile.occupation}
                    </p>
                  )}

                  <div className="mt-3">
                    <VerificationBadges
                      isVerified={kycVerified || profile.is_verified}
                      isZentraVerified={isZentraVerified}
                      role={profile.role === "client" || profile.role === "freelancer" ? profile.role : undefined}
                      className="justify-center"
                    />
                  </div>

                  {location && (
                    <p className="text-xs text-muted-foreground mt-2">{location}</p>
                  )}

                  {freelancerProfile?.hourly_rate && (
                    <p className="text-xl font-bold text-primary mt-3">
                      {format(freelancerProfile.hourly_rate)}/hr
                    </p>
                  )}

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mt-5 pt-5 border-t border-border/60">
                    <div>
                      <p className="text-xl font-bold text-foreground">{completedContractCount}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Projects</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">
                        {freelancerProfile?.years_experience ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Yrs Exp.</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{reviews.length}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Reviews</p>
                    </div>
                  </div>

                  {reviews.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/60 flex justify-center">
                      <RatingStars rating={dynamicRating} count={reviews.length} />
                    </div>
                  )}

                  {/* CTAs */}
                  <div className="mt-5 space-y-2">
                    {isOwner && (
                      <Button variant="outline" size="sm" className="w-full rounded-xl" asChild>
                        <Link to="/settings">
                          <Settings className="h-3.5 w-3.5 mr-1.5" /> Account Settings
                        </Link>
                      </Button>
                    )}
                    {user && !isOwner && isClient && (
                      <>
                        <Button
                          className="w-full rounded-xl"
                          onClick={() =>
                            navigate(
                              `/post-job?invite=${id}&name=${encodeURIComponent(profile.full_name || "Expert")}`,
                            )
                          }
                        >
                          <Send className="h-3.5 w-3.5 mr-1.5" /> Hire
                        </Button>
                      </>
                    )}
                    {!user && (
                      <Button className="w-full rounded-xl" asChild>
                        <Link
                          to={`/auth?redirect=${encodeURIComponent(`/expert/${id}/profile`)}`}
                        >
                          Sign in to Contact
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Skills */}
              {freelancerProfile?.skills && freelancerProfile.skills.length > 0 && (
                <Card className="rounded-2xl border-border/60 overflow-hidden">
                  <SectionHeader label="Skills" />
                  <div className="p-5 flex flex-wrap gap-2">
                    {freelancerProfile.skills.map((skill: string) => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Details */}
              {freelancerProfile && (
                <Card className="rounded-2xl border-border/60 overflow-hidden">
                  <SectionHeader label="Details" />
                  <div className="divide-y divide-border/60">
                    {freelancerProfile.availability && (
                      <div className="flex items-center justify-between px-5 py-3 text-sm">
                        <span className="text-muted-foreground">Availability</span>
                        <span className="font-medium text-foreground">
                          {availabilityLabels[freelancerProfile.availability] ||
                            freelancerProfile.availability}
                        </span>
                      </div>
                    )}
                    {freelancerProfile.years_experience != null && (
                      <div className="flex items-center justify-between px-5 py-3 text-sm">
                        <span className="text-muted-foreground">Experience</span>
                        <span className="font-medium text-foreground">
                          {freelancerProfile.years_experience} yrs
                        </span>
                      </div>
                    )}
                    {responseTimeHours !== null && (
                      <div className="flex items-center justify-between px-5 py-3 text-sm">
                        <span className="text-muted-foreground">Response Time</span>
                        <span className="font-medium text-foreground">
                          {formatResponseTime(responseTimeHours)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-5 py-3 text-sm">
                      <span className="text-muted-foreground">Jobs Completed</span>
                      <span className="font-medium text-foreground">{completedContractCount}</span>
                    </div>
                  </div>
                </Card>
              )}

              {/* KYC — owner only */}
              {isOwner && <KycVerificationCard />}
            </aside>

            {/* ── Main Content (2/3) ────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-5">

              {/* About */}
              {freelancerProfile?.bio && (
                <Card className="rounded-2xl border-border/60 overflow-hidden">
                  <SectionHeader label="About" />
                  <p className="px-6 py-5 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                    {freelancerProfile.bio}
                  </p>
                </Card>
              )}

              {/* Portfolio */}
              {portfolio.length > 0 && (
                <Card className="rounded-2xl border-border/60 overflow-hidden">
                  <SectionHeader
                    label="Portfolio"
                    right={<span className="text-xs text-muted-foreground">{portfolio.length}</span>}
                  />
                  <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {portfolio.map((item) => (
                        <button
                          key={item.id}
                          className="group text-left rounded-xl border border-border/60 overflow-hidden hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5 transition-all focus:outline-none"
                          onClick={() => setSelectedPortfolio(item)}
                        >
                          {item.images?.length > 0 ? (
                            <div className="aspect-video bg-muted overflow-hidden">
                              <img
                                src={item.images[0]}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          ) : (
                            <div className="aspect-video bg-muted flex items-center justify-center">
                              <Image className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                          <div className="p-3">
                            <p className="font-semibold text-sm text-foreground truncate">
                              {item.title}
                            </p>
                            {item.project_type && (
                              <p className="text-xs text-primary mt-0.5">{item.project_type}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* Packages / Services */}
              {services.length > 0 && (
                <Card className="rounded-2xl border-border/60 overflow-hidden">
                  <SectionHeader
                    label="Packages"
                    right={<span className="text-xs text-muted-foreground">{services.length}</span>}
                  />
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {services.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-xl border border-border/60 p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {s.title}
                          </p>
                          {s.price && (
                            <span className="text-sm font-bold text-primary shrink-0">
                              {format(s.price)}
                            </span>
                          )}
                        </div>
                        {s.category && (
                          <p className="text-xs text-muted-foreground mb-1">{s.category}</p>
                        )}
                        {s.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {s.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
                          {s.delivery_days && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {s.delivery_days} {s.delivery_unit || "day(s)"}
                            </span>
                          )}
                          {s.revisions_allowed != null && (
                            <span>
                              {s.revisions_allowed} revision
                              {s.revisions_allowed !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {user && !isOwner && isClient ? (
                          <Button
                            size="sm"
                            className="w-full rounded-lg"
                            onClick={() => navigate(`/messages?user=${id}`)}
                          >
                            Select Package
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="w-full rounded-lg" asChild>
                            <Link
                              to={
                                user
                                  ? `/messages?user=${id}`
                                  : `/auth?redirect=${encodeURIComponent(`/expert/${id}/profile`)}`
                              }
                            >
                              Contact
                            </Link>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Work Experience */}
              {workExperience.length > 0 && (
                <Card className="rounded-2xl border-border/60 overflow-hidden">
                  <SectionHeader
                    label="Work Experience"
                    right={
                      <span className="text-xs text-muted-foreground">{workExperience.length}</span>
                    }
                  />
                  <div className="divide-y divide-border/60">
                    {workExperience.map((exp) => (
                      <div key={exp.id} className="px-6 py-4">
                        <div className="flex items-start justify-between gap-3 mb-0.5">
                          <p className="font-semibold text-sm text-foreground">{exp.role}</p>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {exp.start_year} – {exp.is_current ? "Present" : exp.end_year || "N/A"}
                          </span>
                        </div>
                        <p className="text-xs text-primary mb-1">{exp.company}</p>
                        {exp.description && (
                          <p className="text-sm text-muted-foreground">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Certifications */}
              {certifications.length > 0 && (
                <Card className="rounded-2xl border-border/60 overflow-hidden">
                  <SectionHeader
                    label="Certifications"
                    right={
                      <span className="text-xs text-muted-foreground">{certifications.length}</span>
                    }
                  />
                  <div className="divide-y divide-border/60">
                    {certifications.map((cert) => (
                      <div key={cert.id} className="flex items-start gap-3 px-6 py-4">
                        <Award className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground">{cert.name}</p>
                          {cert.issuer && (
                            <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                          )}
                          {cert.year_obtained && (
                            <p className="text-xs text-muted-foreground">{cert.year_obtained}</p>
                          )}
                          {cert.credential_url && (
                            <a
                              href={cert.credential_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              View Credential
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* ZentraGig Contracts */}
              {pastContracts.length > 0 && (
                <Card className="rounded-2xl border-border/60 overflow-hidden">
                  <SectionHeader
                    label="ZentraGig Contracts"
                    right={
                      <span className="text-xs text-muted-foreground">{pastContracts.length}</span>
                    }
                  />
                  <ContractsCarousel contracts={pastContracts} />
                </Card>
              )}

              {/* Reviews */}
              <Card className="rounded-2xl border-border/60 overflow-hidden">
                <SectionHeader
                  label="Reviews"
                  right={
                    reviews.length > 0 ? (
                      <RatingStars rating={dynamicRating} count={reviews.length} />
                    ) : undefined
                  }
                />
                {reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">No reviews yet.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {reviews.map((review, i: number) => {
                      const reviewerName = review.reviewer?.full_name || "Client";
                      const reviewerAvatar = review.reviewer?.avatar_url || null;
                      const contractTitle = review.contract?.job_title || null;
                      return (
                        <div key={review.id || i} className="px-6 py-4">
                          <div className="flex items-start gap-3 mb-2">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={reviewerAvatar || undefined} />
                              <AvatarFallback className="text-xs bg-muted">
                                {getInitials(reviewerName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-foreground">{reviewerName}</p>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {review.created_at
                                    ? new Date(review.created_at).toLocaleDateString("en-NG", {
                                        year: "numeric",
                                        month: "short",
                                      })
                                    : ""}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 mt-0.5">
                                {Array.from({ length: 5 }).map((_, j) => (
                                  <Star
                                    key={j}
                                    className={`h-3 w-3 ${
                                      j < (review.rating || 0)
                                        ? "fill-warning text-warning"
                                        : "text-muted-foreground/30"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          {contractTitle && (
                            <p className="text-xs text-primary mb-1 ml-11">{contractTitle}</p>
                          )}
                          {review.comment && (
                            <p className="text-sm text-muted-foreground ml-11">{review.comment}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Empty state */}
              {!hasContent && (
                <Card className="rounded-2xl border-border/60">
                  <div className="py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      This expert hasn't added profile details yet.
                    </p>
                    {isOwner && (
                      <Button
                        className="mt-4 rounded-xl"
                        variant="outline"
                        onClick={() => navigate("/settings")}
                      >
                        Complete Profile
                      </Button>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {/* Portfolio Dialog */}
      <Dialog open={!!selectedPortfolio} onOpenChange={() => setSelectedPortfolio(null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
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
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {selectedPortfolio.description}
              </p>
            )}
            {selectedPortfolio?.software_used?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Software Used
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPortfolio.software_used.map((s: string) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setSelectedPortfolio(null)}
            >
              <X className="h-4 w-4 mr-1.5" /> Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
