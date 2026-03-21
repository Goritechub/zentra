import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { declineReceivedOffer, getReceivedOffers } from "@/api/offers.api";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Inbox, Loader2, ArrowLeft, MapPin, Clock, CheckCircle2, XCircle,
  Lock, DollarSign, Calendar
} from "lucide-react";

export default function ReceivedOffersPage() {
  const { user, bootstrapStatus, authError } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [showDecline, setShowDecline] = useState(false);

  useEffect(() => {
    if (!user) navigate("/auth");
    if (user) fetchOffers();
  }, [user]);

  const fetchOffers = async () => {
    if (!user) return;
    const offers = await getReceivedOffers();
    setOffers(offers);
    setLoading(false);
  };

  // Accept handler removed — Accept now navigates to /job/:id/apply



  const handleDecline = async () => {
    if (!selected || !user) return;
    setActionLoading(true);
    try {
      await declineReceivedOffer({
        offerType: selected._type,
        offerId: selected._type === "direct_offer" ? selected.id : null,
        jobId: selected._type === "job_offer" ? selected.job_id : null,
        title: selected.title || null,
        clientId: selected.client_id || null,
      });
      toast.success("Offer declined.");
      await fetchOffers();
      setShowDecline(false);
      setSelected(null);
    } catch {
      toast.error("Failed to decline offer");
    }
    setActionLoading(false);
  };

  if (!user || bootstrapStatus !== "ready") return null;

  const pendingOffers = offers.filter(o => o.status === "pending");
  const respondedOffers = offers.filter(o => o.status !== "pending");

  const OfferCard = ({ offer }: { offer: any }) => (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-start gap-4">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarImage src={offer.client?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {(offer.client?.full_name || "C")[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground">{offer.title}</h3>
                {offer._type === "job_offer" && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Lock className="h-3 w-3" /> Private Job
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                From <span className="font-medium text-foreground">{offer.client?.full_name || "Client"}</span>
              </p>
            </div>
            <Badge
              variant={offer.status === "pending" ? "outline" : offer.status === "accepted" ? "default" : "destructive"}
              className="capitalize shrink-0"
            >
              {offer.status}
            </Badge>
          </div>

          {offer.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{offer.description}</p>
          )}

          <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
            {(offer.budget_min || offer.budget_max || offer.budget) && (
              <span className="flex items-center gap-1 font-semibold text-primary text-sm">
                <DollarSign className="h-3.5 w-3.5" />
                {offer.budget_min && offer.budget_max
                  ? `${formatNaira(offer.budget_min)} – ${formatNaira(offer.budget_max)}`
                  : formatNaira(offer.budget || offer.budget_max || offer.budget_min)}
              </span>
            )}
            {offer.delivery_days && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {offer.delivery_days} {offer.delivery_unit || "days"}
              </span>
            )}
            {offer.state && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {offer.is_remote ? "Remote" : `${offer.city || ""} ${offer.state}`}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDistanceToNow(new Date(offer.created_at), { addSuffix: true })}
            </span>
          </div>

          {offer.required_skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {offer.required_skills.slice(0, 4).map((s: string) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          )}

          {offer.status === "pending" && (
            <div className="flex flex-wrap gap-2 mt-4">
              <Button size="sm" onClick={() => navigate(`/job/${offer._type === "job_offer" ? offer.job_id : offer.job_id || offer.id}/apply`)}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => { setSelected(offer); setShowDecline(true); }}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" /> Bow Out
              </Button>
            </div>
          )}
          {offer.status === "accepted" && offer._type === "job_offer" && (
            <div className="mt-3">
              <Button size="sm" variant="outline" asChild>
                <Link to={`/job/${offer.job_id}`}>View Job Details</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide max-w-3xl">
          {authError && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {authError}
            </div>
          )}
          {loading && (
            <p className="mb-4 text-sm text-muted-foreground">Refreshing offers...</p>
          )}
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Inbox className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Received Offers</h1>
              <p className="text-sm text-muted-foreground">Direct and private job offers from clients</p>
            </div>
            {pendingOffers.length > 0 && (
              <Badge variant="destructive" className="ml-auto">{pendingOffers.length} pending</Badge>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-44 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-28 rounded bg-muted/80 animate-pulse" />
                      <div className="h-3 w-56 rounded bg-muted/70 animate-pulse" />
                    </div>
                    <div className="h-6 w-20 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : pendingOffers.length === 0 && respondedOffers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border">
              <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No offers yet</p>
              <p className="text-sm mt-1">When clients send you private job offers, they'll appear here</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingOffers.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Pending ({pendingOffers.length})
                  </h2>
                  <div className="space-y-4">
                    {pendingOffers.map(o => <OfferCard key={`${o._type}-${o.id}`} offer={o} />)}
                  </div>
                </div>
              )}
              {respondedOffers.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Responded
                  </h2>
                  <div className="space-y-4">
                    {respondedOffers.map(o => <OfferCard key={`${o._type}-${o.id}`} offer={o} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Decline Confirm Dialog */}
      <Dialog open={showDecline} onOpenChange={setShowDecline}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Offer</DialogTitle>
            <DialogDescription>
              You're declining "{selected?.title}". The client will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecline(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDecline} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
