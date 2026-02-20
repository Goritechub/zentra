import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { Send, Loader2, Clock, CheckCircle2, X, ArrowLeft, Lock, Briefcase } from "lucide-react";

export default function SentOffersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<any[]>([]);
  const [privateJobs, setPrivateJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchOffers();
  }, [user, authLoading]);

  const fetchOffers = async () => {
    if (!user) return;
    const [offersRes, jobsRes] = await Promise.all([
      supabase
        .from("offers" as any)
        .select("*, freelancer:profiles!offers_freelancer_id_fkey(full_name, avatar_url)")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("jobs")
        .select("*, invitedExperts:profiles!inner(id, full_name, avatar_url)")
        .eq("client_id", user.id)
        .eq("visibility", "private")
        .eq("status", "open")
        .order("created_at", { ascending: false }),
    ]);
    setOffers((offersRes.data as any[]) || []);
    setPrivateJobs((jobsRes.data as any[]) || []);
    setLoading(false);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-accent" />;
      case "accepted": return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "rejected": return <X className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div><Footer /></div>;
  }

  const totalItems = offers.length + privateJobs.length;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-8">Sent Offers</h1>

          {totalItems === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No offers sent yet</p>
              <p className="text-sm mt-1">Send direct offers to experts from their profiles, or post a private job</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Private Job Offers */}
              {privateJobs.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Private Jobs ({privateJobs.length})
                  </h2>
                  <div className="space-y-4">
                    {privateJobs.map((job: any) => (
                      <div key={job.id} className="bg-card rounded-xl border border-border p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground">{job.title}</h3>
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Lock className="h-3 w-3" /> Private
                              </Badge>
                            </div>
                            {job.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{job.description}</p>}
                            <p className="text-xs text-muted-foreground mt-2">
                              Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                              {" · "}{(job.invited_expert_ids || []).length} expert(s) invited
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            {(job.budget_min || job.budget_max) && (
                              <p className="font-bold text-primary">
                                {job.budget_min && job.budget_max
                                  ? `${formatNaira(job.budget_min)} – ${formatNaira(job.budget_max)}`
                                  : formatNaira(job.budget_max || job.budget_min)}
                              </p>
                            )}
                            <Badge variant="secondary" className="mt-2">Open</Badge>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/job/${job.id}`}>
                              <Briefcase className="h-3.5 w-3.5 mr-1.5" /> View Job
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Offers */}
              {offers.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Send className="h-4 w-4" /> Direct Offers ({offers.length})
                  </h2>
                  <div className="space-y-4">
                    {offers.map((offer: any) => (
                      <div key={offer.id} className="bg-card rounded-xl border border-border p-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">{offer.title}</h3>
                            {offer.freelancer?.full_name && (
                              <p className="text-sm text-muted-foreground mt-0.5">To: {offer.freelancer.full_name}</p>
                            )}
                            {offer.description && <p className="text-sm text-muted-foreground mt-1">{offer.description}</p>}
                            <p className="text-xs text-muted-foreground mt-2">
                              Sent {formatDistanceToNow(new Date(offer.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="text-right">
                            {offer.budget && <p className="font-bold text-primary">{formatNaira(offer.budget)}</p>}
                            <Badge variant={offer.status === "accepted" ? "default" : "secondary"} className="mt-2 gap-1">
                              {statusIcon(offer.status)} {offer.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
