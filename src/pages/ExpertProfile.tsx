import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Star, MapPin, ArrowLeft, ChevronLeft, ChevronRight, X,
  Send, Briefcase, Award, Building2, Settings, Share2, Download, Link as LinkIcon,
  Image, Clock, MessageSquare, Package,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getExpertProfileOverview } from "@/api/expert-read.api";
import { useAuth } from "@/hooks/useAuth";
import { formatNaira } from "@/lib/nigerian-data";
import { toast } from "sonner";
import { VerificationBadges } from "@/components/VerificationBadges";
import { KycVerificationCard } from "@/components/KycVerificationCard";
import { useKycVerification } from "@/hooks/useKycVerification";
import html2canvas from "html2canvas";

// ── helpers ────────────────────────────────────────────────────────────────────

function formatResponseTime(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "N/A";
  if (hours < 1) return "< 1 hour";
  if (hours < 24) {
    const h = Math.round(hours);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const d = Math.round(hours / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}

function getInitials(name: string | null) {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
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
            onClick={() => setIdx(i => (i - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIdx(i => (i + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
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

function RatingStars({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
        ))}
      </div>
      <span className="text-sm font-medium">{rating > 0 ? rating.toFixed(1) : "0.0"}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
}

function ContractsCarousel({ contracts }: { contracts: any[] }) {
  const [idx, setIdx] = useState(0);
  if (!contracts || contracts.length === 0) return null;
  const c = contracts[idx];
  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg border border-border p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground truncate">{c.job_title || "Untitled Contract"}</h4>
            {c.job_category && <p className="text-xs text-primary mt-0.5">{c.job_category}</p>}
          </div>
          <Badge variant={c.status === "completed" ? "default" : "secondary"} className="shrink-0 ml-2 capitalize text-xs">
            {c.status}
          </Badge>
        </div>
        {c.job_description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{c.job_description}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {c.started_at && <span>Started: {new Date(c.started_at).toLocaleDateString()}</span>}
          {c.completed_at && <span>Completed: {new Date(c.completed_at).toLocaleDateString()}</span>}
        </div>
        {c.review && (
          <div className="border-t border-border pt-3 mt-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3 w-3 ${i < c.review.rating ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">by {c.review.reviewer_name || "Client"}</span>
            </div>
            {c.review.comment && <p className="text-xs text-muted-foreground mt-1">{c.review.comment}</p>}
          </div>
        )}
      </div>
      {contracts.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setIdx(i => (i - 1 + contracts.length) % contracts.length)} className="p-1.5 rounded-full border border-border hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">{idx + 1} of {contracts.length}</span>
          <button onClick={() => setIdx(i => (i + 1) % contracts.length)} className="p-1.5 rounded-full border border-border hover:bg-muted transition-colors">
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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile: authProfile } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [pastContracts, setPastContracts] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [workExperience, setWorkExperience] = useState<any[]>([]);
  const [completedContractCount, setCompletedContractCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedPortfolio, setSelectedPortfolio] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);

  const { isVerified: kycVerified, isZentraVerified, loading: kycLoading } = useKycVerification(id);

  const [showShareMenu, setShowShareMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const dynamicRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
      : 0;

  const isOwner = user?.id === id;
  const isClient = authProfile?.role === "client";

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      if (!cancelled) setLoading(true);
      try {
        const response = await getExpertProfileOverview(id);
        if (cancelled) return;
        setProfile(response.data.profile || null);
        setFreelancerProfile(response.data.freelancerProfile || null);
        setCertifications(response.data.certifications || []);
        setWorkExperience(response.data.workExperience || []);
        setServices(response.data.services || []);
        setPortfolio(response.data.portfolio || []);
        setPastContracts(response.data.pastContracts || []);
        setCompletedContractCount(response.data.completedContractCount || 0);
        setReviews(response.data.reviews || []);
      } catch {
        if (cancelled) return;
        setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/expert/${id}/profile`);
    toast.success("Profile link copied!");
    setShowShareMenu(false);
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
        win.document.write(`<html><head><title>${profile?.full_name || "Expert"} Profile</title><style>body{margin:0;display:flex;justify-content:center;}img{max-width:100%;height:auto;}</style></head><body><img src="${imgData}" /></body></html>`);
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
        <main className="flex-1">
          <div className="container-wide py-8">
            <Skeleton className="h-9 w-20 mb-6" />
            {/* Hero card */}
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <Skeleton className="h-24 w-24 rounded-full shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-4 w-36" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </div>
            </div>
            {/* Content + sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <Skeleton className="h-5 w-28 mb-4" />
                  <Skeleton className="aspect-video w-full rounded-lg mb-4" />
                  <div className="flex flex-wrap gap-2">
                    {[80, 64, 72, 56, 88, 60].map((w, i) => (
                      <Skeleton key={i} className="h-6 rounded-full" style={{ width: w }} />
                    ))}
                  </div>
                </div>
                <div className="bg-card rounded-xl border border-border p-6">
                  <Skeleton className="h-5 w-20 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-card rounded-xl border border-border p-6">
                  <Skeleton className="h-11 w-full mb-3" />
                  <Skeleton className="h-11 w-full" />
                </div>
                <div className="bg-card rounded-xl border border-border p-6">
                  <Skeleton className="h-5 w-28 mb-4" />
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex justify-between">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Expert not found.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const isAvailable = !!freelancerProfile?.availability;
  const responseTimeHours = freelancerProfile?.avg_response_time_hours ?? null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container-wide py-8" ref={profileRef}>

          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            {isOwner && (
              <div className="relative">
                <Button variant="outline" size="sm" onClick={() => setShowShareMenu(!showShareMenu)}>
                  <Share2 className="h-4 w-4 mr-2" /> Share / Export
                </Button>
                {showShareMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 w-48">
                    <button onClick={handleCopyLink} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 rounded-t-lg">
                      <LinkIcon className="h-4 w-4" /> Copy Link
                    </button>
                    <button onClick={handleExportImage} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2">
                      <Image className="h-4 w-4" /> Download Image
                    </button>
                    <button onClick={handleExportPDF} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 rounded-b-lg">
                      <Download className="h-4 w-4" /> Print / PDF
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Hero Header Card ───────────────────────────────────────────── */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">

                {/* Avatar */}
                <Avatar className="h-24 w-24 shrink-0 border-4 border-background shadow-lg">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>

                {/* Name / title / meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-foreground">{profile.full_name}</h1>
                    {profile.username && (
                      <span className="text-sm text-muted-foreground font-normal">@{profile.username}</span>
                    )}
                    {isAvailable && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Available Now
                      </span>
                    )}
                  </div>
                  {(freelancerProfile?.title || profile.occupation) && (
                    <p className="text-muted-foreground font-medium mb-1">
                      {freelancerProfile?.title || profile.occupation}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                    {(profile.city || profile.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {profile.city && `${profile.city}, `}{profile.state || "Global"}
                      </span>
                    )}
                    {freelancerProfile?.hourly_rate && (
                      <span className="text-primary font-semibold">
                        {formatNaira(freelancerProfile.hourly_rate)}/hr
                      </span>
                    )}
                    {reviews.length > 0 && (
                      <RatingStars rating={dynamicRating} count={reviews.length} />
                    )}
                  </div>
                  {(kycVerified || profile.is_verified) && (
                    <VerificationBadges isVerified={kycVerified || profile.is_verified} isZentraVerified={isZentraVerified} role={profile.role} />
                  )}
                </div>

                {/* CTAs */}
                <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                  {isOwner && (
                    <Button variant="outline" onClick={() => navigate("/my-profile")}>
                      <Settings className="h-4 w-4 mr-2" /> Edit Profile
                    </Button>
                  )}
                  {user && !isOwner && isClient && (
                    <>
                      <Button asChild variant="outline">
                        <Link to={`/messages?user=${id}`}>
                          <MessageSquare className="h-4 w-4 mr-2" /> Contact
                        </Link>
                      </Button>
                      <Button onClick={() => navigate(`/post-job?invite=${id}&name=${encodeURIComponent(profile.full_name || "Expert")}`)}>
                        <Send className="h-4 w-4 mr-2" /> Hire
                      </Button>
                    </>
                  )}
                  {user && !isOwner && !isClient && (
                    <Button asChild variant="outline">
                      <Link to={`/messages?user=${id}`}>
                        <MessageSquare className="h-4 w-4 mr-2" /> Message
                      </Link>
                    </Button>
                  )}
                  {!user && (
                    <Button asChild>
                      <Link to={`/auth?redirect=${encodeURIComponent(`/expert/${id}/profile`)}`}>
                        Sign in to Contact
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Stat Blocks ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{completedContractCount}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" /> Projects Completed
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {responseTimeHours !== null ? formatResponseTime(responseTimeHours) : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Avg. Response Time
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{reviews.length}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <Star className="h-3.5 w-3.5" /> Reviews
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Main Content + Sidebar ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Left / Main column ─────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">

              {/* About */}
              {freelancerProfile?.bio && (
                <Card>
                  <CardHeader><CardTitle className="text-base">About</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{freelancerProfile.bio}</p>
                  </CardContent>
                </Card>
              )}

              {/* Skills */}
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

              {/* Portfolio – 3-col grid */}
              {portfolio.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Portfolio</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {portfolio.map((item) => (
                        <button
                          key={item.id}
                          className="group text-left border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                          onClick={() => setSelectedPortfolio(item)}
                        >
                          {item.images?.length > 0 ? (
                            <div className="aspect-video bg-muted overflow-hidden">
                              <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                            </div>
                          ) : (
                            <div className="aspect-video bg-muted flex items-center justify-center">
                              <Image className="h-8 w-8 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="p-3">
                            <p className="font-semibold text-sm text-foreground truncate">{item.title}</p>
                            {item.project_type && <p className="text-xs text-primary mt-0.5">{item.project_type}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Certifications */}
              {certifications.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="h-4 w-4" /> Certifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {certifications.map((cert: any) => (
                        <div key={cert.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <Award className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm">{cert.name}</p>
                            {cert.issuer && <p className="text-xs text-muted-foreground">{cert.issuer}</p>}
                            {cert.year_obtained && <p className="text-xs text-muted-foreground">{cert.year_obtained}</p>}
                            {cert.credential_url && (
                              <a href={cert.credential_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                                View Credential
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Work Experience */}
              {workExperience.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Work Experience
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {workExperience.map((exp: any) => (
                        <div key={exp.id} className="border-l-2 border-primary/30 pl-4">
                          <p className="font-medium text-foreground text-sm">{exp.role}</p>
                          <p className="text-xs text-primary">{exp.company}</p>
                          <p className="text-xs text-muted-foreground">
                            {exp.start_year} – {exp.is_current ? "Present" : (exp.end_year || "N/A")}
                          </p>
                          {exp.description && <p className="text-sm text-muted-foreground mt-1">{exp.description}</p>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ZentraGig Contracts */}
              {pastContracts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="h-4 w-4" /> ZentraGig Contracts
                      <span className="text-xs font-normal text-muted-foreground">({pastContracts.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ContractsCarousel contracts={pastContracts} />
                  </CardContent>
                </Card>
              )}

              {/* Reviews – listed section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Reviews
                    {reviews.length > 0 && <RatingStars rating={dynamicRating} count={reviews.length} />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No reviews yet.</p>
                  ) : (
                    <div className="space-y-5">
                      {reviews.map((review: any, i: number) => {
                        const reviewerName = (review.reviewer as any)?.full_name || "Client";
                        const reviewerAvatar = (review.reviewer as any)?.avatar_url || null;
                        const contractTitle = (review.contract as any)?.job_title || null;
                        return (
                          <div key={review.id || i} className="flex gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={reviewerAvatar || undefined} />
                              <AvatarFallback className="text-xs bg-muted">{getInitials(reviewerName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-sm font-medium text-foreground">{reviewerName}</p>
                                <span className="text-xs text-muted-foreground">
                                  {review.created_at ? new Date(review.created_at).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" }) : ""}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 mt-0.5 mb-1">
                                {Array.from({ length: 5 }).map((_, j) => (
                                  <Star key={j} className={`h-3 w-3 ${j < (review.rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                                ))}
                              </div>
                              {contractTitle && (
                                <p className="text-xs text-primary mb-1">{contractTitle}</p>
                              )}
                              {review.comment && (
                                <p className="text-sm text-muted-foreground">{review.comment}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Empty state */}
              {!freelancerProfile?.bio &&
                (freelancerProfile?.skills?.length || 0) === 0 &&
                services.length === 0 &&
                certifications.length === 0 &&
                workExperience.length === 0 &&
                portfolio.length === 0 &&
                pastContracts.length === 0 && (
                  <Card>
                    <CardContent className="py-10 text-center">
                      <p className="text-sm text-muted-foreground">This expert has not added detailed profile information yet.</p>
                      {isOwner && (
                        <Button className="mt-4" variant="outline" onClick={() => navigate("/my-profile")}>
                          Complete Profile
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
            </div>

            {/* ── Right Sidebar ──────────────────────────────────────────── */}
            <div className="space-y-6">

              {/* Packages / Services */}
              {services.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" /> Packages
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4 pt-0">
                    {services.map((s: any) => (
                      <div key={s.id} className="rounded-lg border border-border p-4 space-y-2 hover:border-primary/40 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground leading-snug">{s.title}</p>
                          {s.price && (
                            <span className="text-sm font-bold text-primary shrink-0">{formatNaira(s.price)}</span>
                          )}
                        </div>
                        {s.category && <p className="text-xs text-muted-foreground">{s.category}</p>}
                        {s.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {s.delivery_days && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {s.delivery_days} {s.delivery_unit || "day(s)"}
                            </span>
                          )}
                          {s.revisions_allowed != null && (
                            <span>{s.revisions_allowed} revision{s.revisions_allowed !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                        {user && !isOwner && isClient && (
                          <Button size="sm" className="w-full mt-1" onClick={() => navigate(`/messages?user=${id}`)}>
                            Select Package
                          </Button>
                        )}
                        {(!user || isOwner || !isClient) && (
                          <Button size="sm" variant="outline" className="w-full mt-1" asChild>
                            <Link to={user ? `/messages?user=${id}` : `/auth?redirect=${encodeURIComponent(`/expert/${id}/profile`)}`}>
                              Contact
                            </Link>
                          </Button>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Details */}
              {freelancerProfile && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {freelancerProfile.years_experience != null && (
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
                    {responseTimeHours !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Response Time</span>
                        <span className="font-medium">{formatResponseTime(responseTimeHours)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Jobs Completed</span>
                      <span className="font-medium">{completedContractCount}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* KYC Verification Card – owner only */}
              {isOwner && <KycVerificationCard />}
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
    </div>
  );
}
