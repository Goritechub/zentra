import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { NetworkError } from "@/components/NetworkError";
import { classifyError, logError } from "@/lib/error-utils";
import { getPublicServiceById, type PublicServiceResponse } from "@/api/client-read.api";
import { useCurrency } from "@/hooks/useCurrency";
import { useShare } from "@/hooks/useShare";
import {
  ArrowLeft, Star, Clock, RotateCcw, Send, Share2, ChevronLeft, ChevronRight, BadgeCheck, MapPin,
} from "lucide-react";

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const { share } = useShare();

  const [service, setService] = useState<PublicServiceResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [galleryIdx, setGalleryIdx] = useState(0);

  const fetchService = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const response = await getPublicServiceById(id!);
      setService(response.data);
      setGalleryIdx(0);
    } catch (err) {
      logError("ServiceDetail", err);
      setFetchError(err instanceof Error ? err : new Error("Failed to load service"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchService();
      window.scrollTo(0, 0);
    }
  }, [id, fetchService]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 bg-muted/30 py-8">
          <div className="container-wide max-w-5xl space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (fetchError || !service) {
    const kind = classifyError(fetchError);
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 bg-muted/30 py-8">
          <div className="container-wide max-w-5xl">
            <NetworkError
              error={fetchError}
              title={kind === "not_found" ? "Service not found" : undefined}
              message={kind === "not_found" ? "This service doesn't exist or is no longer active." : undefined}
              onRetry={kind !== "not_found" ? fetchService : undefined}
            />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const freelancer = service.freelancer;
  const images = service.images || [];
  const others = service.other_services || [];
  const shareUrl = `${window.location.origin}/service/${service.id}`;
  const profileUrl = `/expert/${freelancer?.username || freelancer?.id}/profile`;
  const location = [freelancer?.city, freelancer?.state].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title={service.title}
        description={service.description?.slice(0, 155) || undefined}
        image={images[0]}
        type="website"
      />
      <Header />
      <main className="flex-1 bg-muted/30 py-6 sm:py-10">
        <div className="container-wide max-w-5xl">
          <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate("/browse-services")}>
            <ArrowLeft className="h-4 w-4" /> Back to services
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Left column — content */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {images.length > 0 && (
                <>
                  <div className="relative aspect-video bg-muted">
                    <img
                      src={images[galleryIdx]}
                      alt={service.title}
                      className="w-full h-full object-cover"
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={() => setGalleryIdx((i) => (i - 1 + images.length) % images.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 hover:bg-background flex items-center justify-center shadow-sm"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setGalleryIdx((i) => (i + 1) % images.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 hover:bg-background flex items-center justify-center shadow-sm"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                  {images.length > 1 && (
                    <div className="flex gap-2 p-3 overflow-x-auto border-b border-border">
                      {images.map((img, i) => (
                        <button
                          key={img + i}
                          onClick={() => setGalleryIdx(i)}
                          className={`shrink-0 h-14 w-20 rounded-md overflow-hidden border-2 transition-colors ${
                            i === galleryIdx ? "border-primary" : "border-transparent"
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="p-5 sm:p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {service.category && <Badge variant="secondary" className="mb-2">{service.category}</Badge>}
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">{service.title}</h1>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      share({
                        title: service.title,
                        text: `now offering ${service.title} on ZentraGig.com, visit my page to hire me now.`,
                        url: shareUrl,
                      })
                    }
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-sm text-foreground/90 whitespace-pre-line">{service.description}</p>

                {service.skills && service.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {service.skills.map((s) => (
                      <Badge key={s} variant="outline">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right column — freelancer + pricing sidebar */}
            <div className="lg:sticky lg:top-6 self-start space-y-4">
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <Link to={profileUrl} className="flex items-center gap-3 group">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={freelancer?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(freelancer?.full_name || "U")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                      <span className="truncate">{freelancer?.full_name || "Expert"}</span>
                      {freelancer?.is_verified && (
                        <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </p>
                    {(freelancer?.occupation || location) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {freelancer?.occupation}
                        {freelancer?.occupation && location ? " · " : ""}
                        {location && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" /> {location}
                          </span>
                        )}
                      </p>
                    )}
                    {(service.freelancer_rating != null || service.freelancer_jobs > 0) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Star className="h-3 w-3 fill-accent text-accent" />
                        <span className="font-medium text-foreground">{(service.freelancer_rating || 0).toFixed(1)}</span>
                        <span>({service.freelancer_jobs || 0} jobs)</span>
                      </div>
                    )}
                  </div>
                </Link>

                <div className="border-t border-border pt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Price</span>
                    <span className="text-lg font-bold text-primary">
                      {service.price ? (
                        <>{service.pricing_type === "starting_from" ? "From " : ""}{format(service.price)}</>
                      ) : "Negotiable"}
                    </span>
                  </div>
                  {service.delivery_days && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Delivery</span>
                      <span>{service.delivery_days} {service.delivery_unit || "days"}</span>
                    </div>
                  )}
                  {service.revisions_allowed != null && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5"><RotateCcw className="h-4 w-4" /> Revisions</span>
                      <span>{service.revisions_allowed}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  <Button
                    className="w-full gap-1.5"
                    onClick={() =>
                      navigate(
                        `/post-job?invite=${freelancer?.id}&name=${encodeURIComponent(freelancer?.full_name || "")}`,
                      )
                    }
                  >
                    <Send className="h-4 w-4" /> Hire Expert
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(profileUrl)}
                  >
                    View Profile
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {others.length > 0 && (
            <div className="mt-8">
              <h2 className="text-base font-semibold text-foreground mb-3">
                More from {freelancer?.full_name || "this expert"}
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                {others.map((svc) => (
                  <div
                    key={svc.id}
                    onClick={() => navigate(`/service/${svc.id}`)}
                    className="shrink-0 w-56 bg-card rounded-xl border border-border overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="aspect-video bg-muted">
                      {svc.images?.[0] && (
                        <img src={svc.images[0]} alt={svc.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{svc.title}</p>
                      <p className="text-sm font-bold text-primary">
                        {svc.price ? (
                          <>{svc.pricing_type === "starting_from" ? "From " : ""}{format(svc.price)}</>
                        ) : "Negotiable"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
