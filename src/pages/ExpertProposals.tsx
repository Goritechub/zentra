import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { getExpertProposalsOverview, withdrawMyJobProposal } from "@/api/proposals.api";
import { acceptDirectOffer, declineReceivedOffer } from "@/api/offers.api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Loader2, ArrowLeft, Inbox, Clock, UserCheck, FileText, Send, CheckCircle2, X, MessageCircle, LogOut, Mail
} from "lucide-react";
import { FundingStatusBadge } from "@/components/FundingStatusBadge";
import type {
  ExpertOverviewProposal,
  ExpertOverviewOffer,
  ExpertOverviewInvite,
} from "@/types/proposals";
import type { LucideIcon } from "lucide-react";

export default function ExpertProposalsPage() {
  const { format } = useCurrency();
  const { user, profile, bootstrapStatus } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<ExpertOverviewProposal[]>([]);
  const [offers, setOffers] = useState<ExpertOverviewOffer[]>([]);
  const [invites, setInvites] = useState<ExpertOverviewInvite[]>([]);
  const [interviewContracts, setInterviewContracts] = useState<Record<string, string>>({});
  const [withdrawConfirm, setWithdrawConfirm] = useState<ExpertOverviewProposal | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [decliningInviteId, setDecliningInviteId] = useState<string | null>(null);
  const [inviteDeclineConfirm, setInviteDeclineConfirm] = useState<ExpertOverviewInvite | null>(null);
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);
  const [offerDeclineConfirm, setOfferDeclineConfirm] = useState<ExpertOverviewOffer | null>(null);
  const [offerDeclining, setOfferDeclining] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const data = await getExpertProposalsOverview();
    setProposals(data.proposals || []);
    setOffers(data.offers || []);
    setInvites(data.invites || []);
    setInterviewContracts(data.interviewContracts || {});
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) navigate("/auth");
    if (user) fetchData();
  }, [user, navigate, fetchData]);

  if (!user || bootstrapStatus !== "ready") return null;

  const pendingOffers = offers.filter(o => o.status === "pending");
  const interviewingProposals = proposals.filter(p => p.status === "interviewing");
  const applicationProposals = proposals.filter(p => ["pending", "accepted", "rejected", "withdrawn"].includes(p.status));

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: LucideIcon }> = {
      pending: { variant: "outline", icon: Clock },
      interviewing: { variant: "default", icon: UserCheck },
      accepted: { variant: "default", icon: CheckCircle2 },
      rejected: { variant: "destructive", icon: X },
      withdrawn: { variant: "secondary", icon: X },
    };
    const cfg = map[status] || { variant: "secondary" as const, icon: Clock };
    const Icon = cfg.icon;
    return <Badge variant={cfg.variant} className="gap-1 capitalize"><Icon className="h-3 w-3" />{status}</Badge>;
  };

  const handleWithdraw = async () => {
    if (!withdrawConfirm) return;
    setWithdrawingId(withdrawConfirm.id);
    try {
      await withdrawMyJobProposal(withdrawConfirm.id);
      toast.success("Proposal withdrawn.");
      setProposals((prev) => prev.map((p) => p.id === withdrawConfirm.id ? { ...p, status: "withdrawn" } : p));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to withdraw proposal.");
    } finally {
      setWithdrawingId(null);
      setWithdrawConfirm(null);
    }
  };

  const handleDeclineInvite = async () => {
    if (!inviteDeclineConfirm) return;
    setDecliningInviteId(inviteDeclineConfirm.id);
    try {
      await declineReceivedOffer({
        offerType: "job_offer",
        offerId: null,
        jobId: inviteDeclineConfirm.id,
        title: inviteDeclineConfirm.title,
        clientId: inviteDeclineConfirm.client_id,
      });
      setInvites((prev) => prev.filter((i) => i.id !== inviteDeclineConfirm.id));
      toast.success("Invite declined.");
      setInviteDeclineConfirm(null);
    } catch {
      toast.error("Failed to decline invite.");
    } finally {
      setDecliningInviteId(null);
    }
  };

  const handleAcceptOffer = async (offer: ExpertOverviewOffer) => {
    setAcceptingOfferId(offer.id);
    try {
      await acceptDirectOffer(offer.id);
      if (offer.job_id) {
        navigate(`/job/${offer.job_id}/apply`);
      } else {
        toast.success("Offer accepted! The client has been notified.");
        setOffers((prev) => prev.filter((o) => o.id !== offer.id));
      }
    } catch {
      toast.error("Failed to accept offer.");
    } finally {
      setAcceptingOfferId(null);
    }
  };

  const handleDeclineOffer = async () => {
    if (!offerDeclineConfirm) return;
    setOfferDeclining(true);
    try {
      await declineReceivedOffer({
        offerType: "direct_offer",
        offerId: offerDeclineConfirm.id,
        jobId: null,
        title: offerDeclineConfirm.title,
        clientId: offerDeclineConfirm.client_id,
      });
      toast.success("Offer declined.");
      setOffers((prev) => prev.filter((o) => o.id !== offerDeclineConfirm.id));
      setOfferDeclineConfirm(null);
    } catch {
      toast.error("Failed to decline offer.");
    } finally {
      setOfferDeclining(false);
    }
  };

  const EmptyState = ({ icon: Icon, text }: { icon: LucideIcon; text: string }) => (
    <div className="text-center py-16 text-muted-foreground">
      <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>{text}</p>
    </div>
  );

  const ProposalCard = ({ p }: { p: ExpertOverviewProposal }) => (
    <div className="bg-card rounded-xl border border-border p-6 card-hover">
      <div className="flex items-start justify-between gap-4">
        <Link to={`/job/${p.job?.id}`} className="flex-1">
          <h3 className="font-semibold text-foreground hover:text-primary transition-colors">{p.job?.title || "Untitled Job"}</h3>
          <p className="text-sm text-muted-foreground mt-1">By {p.job?.client?.full_name || "Client"}</p>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{p.cover_letter}</p>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{p.delivery_days} days</span>
            <span>{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
          </div>
        </Link>
        <div className="flex flex-col items-end shrink-0 gap-2">
          <p className="text-lg font-bold text-primary">{format(p.bid_amount)}</p>
          {statusBadge(p.status)}
          {p.job?.client_id && (
            <FundingStatusBadge
              clientId={p.job.client_id}
              budgetMin={p.job.budget_min}
              budgetMax={p.job.budget_max}
            />
          )}
          {p.status === "interviewing" && interviewContracts[p.id] ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={(e) => {
                e.preventDefault();
                navigate(`/contract/${interviewContracts[p.id]}?tab=chat`);
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" /> Go to Chat
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              title={`Message ${p.job?.client?.full_name || "client"}`}
              onClick={(e) => {
                e.preventDefault();
                if (interviewContracts[p.id]) {
                  navigate(`/contract/${interviewContracts[p.id]}?tab=chat`);
                }
              }}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          )}
          {p.status === "pending" && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={withdrawingId === p.id}
              onClick={(e) => { e.preventDefault(); setWithdrawConfirm(p); }}
            >
              {withdrawingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              Withdraw
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const OfferCard = ({ o }: { o: ExpertOverviewOffer }) => (
    <div className="bg-card rounded-xl border border-border p-6 card-hover">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={o.client?.avatar_url} />
            <AvatarFallback>{(o.client?.full_name || "C")[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">{o.title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">From {o.client?.full_name || "Client"}</p>
            {o.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{o.description}</p>}
            <p className="text-xs text-muted-foreground mt-3">{formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}</p>
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-2">
          {o.budget && <p className="text-lg font-bold text-primary">{format(o.budget)}</p>}
          <Badge variant={o.status === "pending" ? "outline" : "secondary"} className="gap-1 capitalize">
            {o.status === "pending" ? <Inbox className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {o.status}
          </Badge>
          {o.status === "pending" && (
            <>
              <Button
                size="sm"
                className="gap-1"
                disabled={acceptingOfferId === o.id}
                onClick={() => handleAcceptOffer(o)}
              >
                {acceptingOfferId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => setOfferDeclineConfirm(o)}
              >
                <X className="h-3.5 w-3.5" />
                Decline
              </Button>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            title={`Message ${o.client?.full_name || "client"}`}
            onClick={() => navigate(`/messages?user=${o.client_id}`)}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  const InviteCard = ({ invite }: { invite: ExpertOverviewInvite }) => (
    <div className="bg-card rounded-xl border border-border p-6 card-hover">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={invite.client?.avatar_url} />
            <AvatarFallback>{(invite.client?.full_name || "C")[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{invite.title}</h3>
            <Badge variant="outline" className="text-xs capitalize shrink-0">
              {invite.visibility === "private" ? "Private" : "Public"} Job
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            From{" "}
            <Link
              to={`/client/${invite.client_id}/profile`}
              className="text-foreground hover:text-primary transition-colors font-medium"
            >
              {invite.client?.full_name || "Client"}
            </Link>
          </p>
          {invite.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{invite.description}</p>
          )}
          {invite.required_skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {invite.required_skills.slice(0, 5).map((s: string) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">{formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}</p>
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-2">
          {(invite.budget_min || invite.budget_max) && (
            <p className="text-sm font-bold text-primary">
              {invite.budget_min && invite.budget_max
                ? `${format(invite.budget_min)} – ${format(invite.budget_max)}`
                : format(invite.budget_max || invite.budget_min)}
            </p>
          )}
          <Button size="sm" onClick={() => navigate(`/job/${invite.id}/apply`)}>
            View & Apply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            disabled={decliningInviteId === invite.id}
            onClick={() => setInviteDeclineConfirm(invite)}
          >
            {decliningInviteId === invite.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Decline
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">

          {loading && (
            <p className="mb-4 text-sm text-muted-foreground">Refreshing proposals and offers...</p>
          )}
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-8">My Proposals & Offers</h1>

          <Tabs defaultValue="offers" className="space-y-6">
            <TabsList className="w-full flex-wrap h-auto gap-1">
              <TabsTrigger value="offers" className="flex-1 gap-2">
                Pending Job Offers
                {pendingOffers.length > 0 && <Badge variant="destructive" className="text-xs px-1.5 py-0 min-w-[20px]">{pendingOffers.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="invites" className="flex-1 gap-2">
                Unanswered Invites
                {invites.length > 0 && <Badge variant="destructive" className="text-xs px-1.5 py-0 min-w-[20px]">{invites.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="interviewing" className="flex-1 gap-2">
                Interview in Progress
                {interviewingProposals.length > 0 && <Badge variant="default" className="text-xs px-1.5 py-0 min-w-[20px]">{interviewingProposals.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="applications" className="flex-1">Your Applications</TabsTrigger>
            </TabsList>

            <TabsContent value="offers">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="rounded-xl border border-border bg-card p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="h-5 w-44 rounded bg-muted animate-pulse" />
                          <div className="h-3 w-28 rounded bg-muted/80 animate-pulse" />
                          <div className="h-3 w-56 rounded bg-muted/70 animate-pulse" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-5 w-20 rounded bg-muted animate-pulse" />
                          <div className="h-6 w-16 rounded bg-muted/70 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : pendingOffers.length === 0 ? (
                <EmptyState icon={Inbox} text="No pending job offers at this time." />
              ) : (
                <div className="space-y-4">{pendingOffers.map(o => <OfferCard key={o.id} o={o} />)}</div>
              )}
            </TabsContent>

            <TabsContent value="invites">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="rounded-xl border border-border bg-card p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="h-5 w-44 rounded bg-muted animate-pulse" />
                          <div className="h-3 w-28 rounded bg-muted/80 animate-pulse" />
                          <div className="h-3 w-56 rounded bg-muted/70 animate-pulse" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-8 w-24 rounded bg-muted animate-pulse" />
                          <div className="h-8 w-20 rounded bg-muted/70 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : invites.length === 0 ? (
                <EmptyState icon={Mail} text="No unanswered invites at this time." />
              ) : (
                <div className="space-y-4">{invites.map(i => <InviteCard key={i.id} invite={i} />)}</div>
              )}
            </TabsContent>

            <TabsContent value="interviewing">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="rounded-xl border border-border bg-card p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="h-5 w-44 rounded bg-muted animate-pulse" />
                          <div className="h-3 w-28 rounded bg-muted/80 animate-pulse" />
                          <div className="h-3 w-56 rounded bg-muted/70 animate-pulse" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-5 w-20 rounded bg-muted animate-pulse" />
                          <div className="h-6 w-16 rounded bg-muted/70 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : interviewingProposals.length === 0 ? (
                <EmptyState icon={UserCheck} text="No interviews currently in progress." />
              ) : (
                <div className="space-y-4">{interviewingProposals.map(p => <ProposalCard key={p.id} p={p} />)}</div>
              )}
            </TabsContent>

            <TabsContent value="applications">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="rounded-xl border border-border bg-card p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="h-5 w-44 rounded bg-muted animate-pulse" />
                          <div className="h-3 w-28 rounded bg-muted/80 animate-pulse" />
                          <div className="h-3 w-56 rounded bg-muted/70 animate-pulse" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-5 w-20 rounded bg-muted animate-pulse" />
                          <div className="h-6 w-16 rounded bg-muted/70 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : applicationProposals.length === 0 ? (
                <EmptyState icon={FileText} text="You haven't submitted any proposals yet." />
              ) : (
                <div className="space-y-4">{applicationProposals.map(p => <ProposalCard key={p.id} p={p} />)}</div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />

      <AlertDialog open={!!withdrawConfirm} onOpenChange={(open) => { if (!open) setWithdrawConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to withdraw your proposal for <strong>{withdrawConfirm?.job?.title || "this job"}</strong>? You won't be able to reapply to this job after withdrawing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleWithdraw}
            >
              {withdrawingId ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!offerDeclineConfirm} onOpenChange={(open) => { if (!open) setOfferDeclineConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Offer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline the offer <strong>"{offerDeclineConfirm?.title}"</strong> from {offerDeclineConfirm?.client?.full_name || "this client"}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeclineOffer}
            >
              {offerDeclining ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Decline Offer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!inviteDeclineConfirm} onOpenChange={(open) => { if (!open) setInviteDeclineConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Invite</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline the invite for <strong>"{inviteDeclineConfirm?.title}"</strong>? This will remove it from your invites list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeclineInvite}
            >
              {decliningInviteId ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Decline Invite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
