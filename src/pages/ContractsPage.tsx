import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import {
  FileText, Loader2, ArrowLeft, CheckCircle2, Clock, XCircle, AlertTriangle
} from "lucide-react";

export default function ContractsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchContracts();
  }, [user, authLoading]);

  const fetchContracts = async () => {
    const isClient = profile?.role === "client";
    const { data } = await supabase
      .from("contracts")
      .select("*, job:jobs!contracts_job_id_fkey(title, status), client:profiles!contracts_client_id_fkey(full_name, avatar_url), freelancer:profiles!contracts_freelancer_id_fkey(full_name, avatar_url)")
      .or(`client_id.eq.${user!.id},freelancer_id.eq.${user!.id}`)
      .order("created_at", { ascending: false });

    setContracts(data || []);
    setLoading(false);
  };

  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any; label: string }> = {
    interviewing: { variant: "outline", icon: Clock, label: "Interviewing" },
    active: { variant: "default", icon: Clock, label: "Active" },
    completed: { variant: "secondary", icon: CheckCircle2, label: "Completed" },
    disputed: { variant: "destructive", icon: AlertTriangle, label: "Disputed" },
    cancelled: { variant: "outline", icon: XCircle, label: "Cancelled" },
    rejected: { variant: "destructive", icon: XCircle, label: "Rejected" },
  };

  const filterByStatus = (status: string) =>
    status === "all" ? contracts : contracts.filter((c) => c.status === status);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  const isClient = profile?.role === "client";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>

          <h1 className="text-3xl font-bold text-foreground mb-8">Contracts</h1>

          <Tabs defaultValue="all">
            <TabsList className="mb-6 flex-wrap h-auto gap-1">
              <TabsTrigger value="all">All ({contracts.length})</TabsTrigger>
              <TabsTrigger value="interviewing">Interviewing ({filterByStatus("interviewing").length})</TabsTrigger>
              <TabsTrigger value="active">Active ({filterByStatus("active").length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({filterByStatus("completed").length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({filterByStatus("rejected").length})</TabsTrigger>
              <TabsTrigger value="disputed">Disputed ({filterByStatus("disputed").length})</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled ({filterByStatus("cancelled").length})</TabsTrigger>
            </TabsList>

            {["all", "interviewing", "active", "completed", "rejected", "disputed", "cancelled"].map((status) => (
              <TabsContent key={status} value={status}>
                {filterByStatus(status).length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No {status === "all" ? "" : status} contracts</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filterByStatus(status).map((contract: any) => {
                      const cfg = statusConfig[contract.status] || statusConfig.active;
                      const Icon = cfg.icon;
                      const partner = isClient ? contract.freelancer : contract.client;

                      return (
                        <div key={contract.id} className="bg-card rounded-xl border border-border p-6 cursor-pointer hover:border-primary transition-colors" onClick={() => navigate(`/contract/${contract.id}`)}>
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={partner?.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {(partner?.full_name || "U")[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-foreground">
                                  {contract.job?.title || "Contract"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  with {partner?.full_name || "User"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Started {formatDistanceToNow(new Date(contract.started_at || contract.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <p className="text-xl font-bold text-primary">{formatNaira(contract.amount)}</p>
                              <Badge variant={cfg.variant} className="gap-1">
                                <Icon className="h-3 w-3" /> {cfg.label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
