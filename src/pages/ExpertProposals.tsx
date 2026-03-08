import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import {
  Loader2, ArrowLeft, Inbox, Clock, UserCheck, FileText, Send, CheckCircle2, X, MessageCircle
} from "lucide-react";
import { FundingStatusBadge } from "@/components/FundingStatusBadge";

export default function ExpertProposalsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [interviewContracts, setInterviewContracts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchData();
  }, [user, authLoading]);

  const fetchData = async () => {
    if (!user) return;
    const [proposalsRes, offersRes] = await Promise.all([
      supabase
        .from("proposals")
        .select("*, job:jobs(id, title, client_id, budget_min, budget_max, is_hourly, status, client:profiles!jobs_client_id_fkey(full_name, avatar_url))")
        .eq("freelancer_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("offers")
        .select("*, client:profiles!offers_client_id_fkey(full_name, avatar_url)")
        .eq("freelancer_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    const allProposals = proposalsRes.data || [];
    setProposals(allProposals);
    setOffers((offersRes.data as any[]) || []);
    setLoading(false);

    // Fetch interview contracts
    const interviewing = allProposals.filter((p: any) => p.status === "interviewing");
    if (interviewing.length) {
      const proposalIds = interviewing.map((p: any) => p.id);
      const { data } = await supabase
        .from("contracts")
        .select("id, proposal_id")
        .in("proposal_id", proposalIds)
        .eq("status", "interviewing" as any);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((c: any) => { if (c.proposal_id) map[c.proposal_id] = c.id; });
        setInterviewContracts(map);
      }
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div><Footer /></div>;
  }

  const pendingOffers = offers.filter(o => o.status === "pending");
  const interviewingProposals = proposals.filter(p => p.status === "interviewing");
  const applicationProposals = proposals.filter(p => ["pending", "accepted", "rejected", "withdrawn"].includes(p.status));

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
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

  const EmptyState = ({ icon: Icon, text }: { icon: any; text: string }) => (
    <div className="text-center py-16 text-muted-foreground">
      <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>{text}</p>
    </div>
  );

  const ProposalCard = ({ p }: { p: any }) => (
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
          <p className="text-lg font-bold text-primary">{formatNaira(p.bid_amount)}</p>
          {statusBadge(p.status)}
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
        </div>
      </div>
    </div>
  );

  const OfferCard = ({ o }: { o: any }) => (
    <div className="bg-card rounded-xl border border-border p-6 card-hover">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{o.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">From {o.client?.full_name || "Client"}</p>
          {o.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{o.description}</p>}
          <p className="text-xs text-muted-foreground mt-3">{formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}</p>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-2">
          {o.budget && <p className="text-lg font-bold text-primary">{formatNaira(o.budget)}</p>}
          <Badge variant={o.status === "pending" ? "outline" : "secondary"} className="gap-1 capitalize">
            {o.status === "pending" ? <Inbox className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {o.status}
          </Badge>
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-8">My Proposals & Offers</h1>

          <Tabs defaultValue="offers" className="space-y-6">
            <TabsList className="flex-wrap">
              <TabsTrigger value="offers" className="gap-2">
                Pending Job Offers
                {pendingOffers.length > 0 && <Badge variant="destructive" className="text-xs px-1.5 py-0 min-w-[20px]">{pendingOffers.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="invites">Unanswered Invites</TabsTrigger>
              <TabsTrigger value="interviewing" className="gap-2">
                Interview in Progress
                {interviewingProposals.length > 0 && <Badge variant="default" className="text-xs px-1.5 py-0 min-w-[20px]">{interviewingProposals.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="applications">Your Applications</TabsTrigger>
            </TabsList>

            <TabsContent value="offers">
              {pendingOffers.length === 0 ? (
                <EmptyState icon={Inbox} text="No pending job offers at this time." />
              ) : (
                <div className="space-y-4">{pendingOffers.map(o => <OfferCard key={o.id} o={o} />)}</div>
              )}
            </TabsContent>

            <TabsContent value="invites">
              <EmptyState icon={Send} text="No unanswered invites at this time." />
            </TabsContent>

            <TabsContent value="interviewing">
              {interviewingProposals.length === 0 ? (
                <EmptyState icon={UserCheck} text="No interviews currently in progress." />
              ) : (
                <div className="space-y-4">{interviewingProposals.map(p => <ProposalCard key={p.id} p={p} />)}</div>
              )}
            </TabsContent>

            <TabsContent value="applications">
              {applicationProposals.length === 0 ? (
                <EmptyState icon={FileText} text="You haven't submitted any proposals yet." />
              ) : (
                <div className="space-y-4">{applicationProposals.map(p => <ProposalCard key={p.id} p={p} />)}</div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
