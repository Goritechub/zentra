import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { getContracts } from "@/api/contracts.api";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import {
  FileText, Loader2, ArrowLeft, CheckCircle2, Clock, XCircle, AlertTriangle
} from "lucide-react";

export default function ContractsPage() {
  const { user, role, bootstrapStatus, authError } = useAuth();
  const navigate = useNavigate();
  const contractsQuery = useQuery({
    queryKey: ["contracts-page", user?.id],
    enabled: bootstrapStatus === "ready" && !!user,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    queryFn: getContracts,
  });

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

  if (!user || bootstrapStatus !== "ready") {
    return null;
  }

  const isClient = role === "client";
  const contracts = contractsQuery.data || [];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          {authError && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {authError}
            </div>
          )}
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>

          <h1 className="text-3xl font-bold text-foreground mb-8">Contracts</h1>
          {contractsQuery.isFetching && (
            <p className="text-sm text-muted-foreground mb-4">Refreshing contracts...</p>
          )}

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
                {contractsQuery.isPending && !contractsQuery.data ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="rounded-xl border border-border bg-card p-6">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                            <div className="space-y-2">
                              <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                              <div className="h-3 w-28 rounded bg-muted/70 animate-pulse" />
                            </div>
                          </div>
                          <div className="space-y-2 text-right">
                            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
                            <div className="h-5 w-20 rounded bg-muted/70 animate-pulse" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filterByStatus(status).length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No {status === "all" ? "" : status} contracts</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filterByStatus(status).map((contract: any) => {
                      // Show "Job Assigned" instead of "Cancelled" when the job was assigned to someone else
                      const isJobAssigned = contract.status === "cancelled" && 
                        contract.job?.status && ["in_progress", "completed"].includes(contract.job.status);
                      const cfg = isJobAssigned
                        ? { variant: "outline" as const, icon: CheckCircle2, label: "Job Assigned" }
                        : (statusConfig[contract.status] || statusConfig.active);
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
                                  with <Link to={`/expert/${partner?.id}/profile`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{partner?.full_name || "User"}</Link>
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
