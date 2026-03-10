import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
import { Star, MapPin, CheckCircle2, ArrowLeft, ChevronLeft, ChevronRight, Eye, X, Send, Briefcase, Award, Building2, Settings, Share2, Download, Link as LinkIcon, Image, ShieldCheck, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatNaira } from "@/lib/nigerian-data";
import { toast } from "sonner";
import { ReviewsCarousel } from "@/components/ReviewsCarousel";
import { VerificationBadges } from "@/components/VerificationBadges";
import { KycVerificationCard } from "@/components/KycVerificationCard";
import { useKycVerification } from "@/hooks/useKycVerification";
import html2canvas from "html2canvas";

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

function RatingDisplay({ rating, reviewCount }: { rating: number | null; reviewCount: number }) {
  const displayRating = reviewCount > 0 ? (rating || 0) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(displayRating) ? "fill-accent text-accent" : "text-muted"}`} />
        ))}
      </div>
      <span className="text-sm font-medium">{displayRating > 0 ? displayRating.toFixed(1) : "0.0"}</span>
      <span className="text-xs text-muted-foreground">({reviewCount} {reviewCount === 1 ? "rating" : "ratings"})</span>
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
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {c.is_remote !== false ? "Remote" : (c.location || "On-site")}
          </span>
          {c.started_at && <span>Started: {new Date(c.started_at).toLocaleDateString()}</span>}
          {c.completed_at && <span>Completed: {new Date(c.completed_at).toLocaleDateString()}</span>}
        </div>
        {c.review && (
          <div className="border-t border-border pt-3 mt-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3 w-3 ${i < c.review.rating ? "fill-accent text-accent" : "text-muted"}`} />
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

  // KYC Verification
  const { isVerified: kycVerified, isZentraVerified, loading: kycLoading } = useKycVerification(id);

  // Export
  const [showShareMenu, setShowShareMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const dynamicRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
    : 0;

  const isOwner = user?.id === id;

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      setLoading(true);
      const [profileRes, fpRes, certsRes, expRes, servicesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase.from("freelancer_profiles").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("certifications").select("*").eq("user_id", id).order("year_obtained", { ascending: false }),
        supabase.from("work_experience").select("*").eq("user_id", id).order("start_year", { ascending: false }),
        supabase.from("service_offers").select("id, title, price, category").eq("freelancer_id", id).eq("is_active", true).limit(10),
      ]);
      setProfile(profileRes.data);
      setFreelancerProfile(fpRes.data);
      setCertifications(certsRes.data || []);
      setWorkExperience(expRes.data || []);
      setServices(servicesRes.data || []);

      if (fpRes.data) {
        const { data: pData } = await supabase.from("portfolio_items").select("*").eq("freelancer_profile_id", fpRes.data.id);
        setPortfolio(pData || []);
      }

      // No longer using old verification_requests

      const { data: contractsData, count: completedCount } = await supabase
        .from("contracts")
        .select("id, job_title, job_description, job_category, amount, status, started_at, completed_at", { count: "exact" })
        .eq("freelancer_id", id)
        .in("status", ["completed", "active"])
        .order("created_at", { ascending: false })
        .limit(20);

      setCompletedContractCount(completedCount || 0);

      if (contractsData && contractsData.length > 0) {
        const contractIds = contractsData.map(c => c.id);
        const { data: contractReviews } = await supabase
          .from("reviews")
          .select("contract_id, rating, comment, reviewer:profiles!reviews_reviewer_id_fkey(full_name)")
          .eq("reviewee_id", id)
          .in("contract_id", contractIds);

        const reviewMap = new Map();
        (contractReviews || []).forEach(r => {
          reviewMap.set(r.contract_id, {
            rating: r.rating,
            comment: r.comment,
            reviewer_name: (r.reviewer as any)?.full_name,
          });
        });

        setPastContracts(contractsData.map(c => ({
          ...c,
          review: reviewMap.get(c.id) || null,
        })));
      }

      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("*, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url), contract:contracts!reviews_contract_id_fkey(job_title, amount)")
        .eq("reviewee_id", id)
        .order("created_at", { ascending: false })
        .limit(30);
      setReviews(reviewsData || []);


      setLoading(false);
    };
    fetch();
  }, [id, user]);

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };


  // Old verification handler removed - now using KYC system

  // Export functions
  const handleCopyLink = () => {
    const url = `${window.location.origin}/expert/${id}/profile`;
    navigator.clipboard.writeText(url);
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
    } catch {
      toast.error("Failed to generate image");
    }
    setShowShareMenu(false);
  };

  const handleExportPDF = async () => {
    if (!profileRef.current) return;
    toast.info("Generating PDF...");
    try {
      const canvas = await html2canvas(profileRef.current, { useCORS: true, scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      // Simple PDF via printable window
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(`
          <html><head><title>${profile?.full_name || "Expert"} Profile</title>
          <style>body{margin:0;display:flex;justify-content:center;}img{max-width:100%;height:auto;}</style></head>
          <body><img src="${imgData}" /></body></html>
        `);
        win.document.close();
        setTimeout(() => { win.print(); }, 500);
      }
    } catch {
      toast.error("Failed to generate PDF");
    }
    setShowShareMenu(false);
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

  const isClient = authProfile?.role === "client";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container-wide py-8" ref={profileRef}>
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />Back
            </Button>
            {/* Share/Export */}
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
                  {profile.username && (
                    <p className="text-sm text-muted-foreground">@{profile.username}</p>
                  )}
                  {freelancerProfile?.title && (
                    <p className="text-muted-foreground">{freelancerProfile.title}</p>
                  )}
                  {profile.occupation && (
                    <p className="text-sm text-muted-foreground">{profile.occupation}</p>
                  )}
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-2">
                    <MapPin className="h-3.5 w-3.5" />
                    {profile.city && `${profile.city}, `}{profile.state || "Nigeria"}
                  </div>
                  {(kycVerified || profile.is_verified) && (
                    <div className="mt-3">
                      <VerificationBadges isVerified={kycVerified || profile.is_verified} isZentraVerified={isZentraVerified} />
                    </div>
                  )}

                  <div className="mt-3 flex justify-center">
                    <RatingDisplay rating={dynamicRating} reviewCount={reviews.length} />
                  </div>

                  {user && user.id === id && (
                    <Button className="w-full mt-4" variant="outline" onClick={() => navigate("/my-profile")}>
                      <Settings className="h-4 w-4 mr-2" /> Edit Profile
                    </Button>
                  )}
                  {user && user.id !== id && isClient && (
                    <Button className="w-full mt-4" onClick={() => navigate(`/post-job?invite=${id}&name=${encodeURIComponent(profile.full_name || "Expert")}`)}>
                      <Send className="h-4 w-4 mr-2" /> Invite / Send an Offer
                    </Button>
                  )}
                  {user && user.id !== id && !isClient && (
                    <Button className="w-full mt-4" variant="outline" asChild>
                      <Link to={`/messages?user=${id}`}>
                        <Send className="h-4 w-4 mr-2" /> Message
                      </Link>
                    </Button>
                  )}
                  {!user && (
                    <Button className="w-full mt-4" asChild>
                      <Link to={`/auth?redirect=${encodeURIComponent(`/expert/${id}/profile`)}`}>
                        Sign in to Contact
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* KYC Verification Card - owner only */}
              {isOwner && <KycVerificationCard />}

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
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Jobs Completed</span>
                      <span className="font-medium">{completedContractCount}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column */}
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

              {/* Services */}
              {services.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Services</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {services.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="text-sm font-medium text-foreground">{s.title}</p>
                            {s.category && <p className="text-xs text-muted-foreground">{s.category}</p>}
                          </div>
                          {s.price && <span className="text-sm font-semibold text-primary">{formatNaira(s.price)}</span>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

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

              {pastContracts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      ZentraGig Contracts
                      <span className="text-xs font-normal text-muted-foreground">({pastContracts.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ContractsCarousel contracts={pastContracts} />
                  </CardContent>
                </Card>
              )}


              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Reviews
                    <RatingDisplay rating={dynamicRating} reviewCount={reviews.length} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reviews.length > 0 ? (
                    <ReviewsCarousel reviews={reviews} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No reviews yet.</p>
                  )}
                </CardContent>
              </Card>
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
