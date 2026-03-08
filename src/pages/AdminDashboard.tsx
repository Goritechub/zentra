import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { DisputeAdjudicator } from "@/components/admin/DisputeAdjudicator";
import {
  ArrowLeft, Loader2, ShieldAlert, UserX, Eye, Flag, Users, AlertTriangle, Gavel
} from "lucide-react";

export default function AdminDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [moderationLogs, setModerationLogs] = useState<any[]>([]);
  const [violators, setViolators] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && user) checkAdminAndFetch();
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  const checkAdminAndFetch = async () => {
    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user!.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const [logsRes, violatorsRes, disputesRes] = await Promise.all([
      supabase.from("moderation_logs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("user_violation_counts").select("*").order("total_violations", { ascending: false }).limit(50),
      supabase.from("disputes").select("*, contract:contracts!disputes_contract_id_fkey(*, client:profiles!contracts_client_id_fkey(full_name), freelancer:profiles!contracts_freelancer_id_fkey(full_name))").order("created_at", { ascending: false }).limit(50),
    ]);

    setModerationLogs(logsRes.data || []);
    setViolators(violatorsRes.data || []);
    setDisputes(disputesRes.data || []);
    setLoading(false);
  };

  const toggleSuspension = async (userId: string, isSuspended: boolean) => {
    await supabase.from("user_violation_counts").update({ is_suspended: !isSuspended }).eq("user_id", userId);
    setViolators(prev => prev.map(v => v.user_id === userId ? { ...v, is_suspended: !isSuspended } : v));
  };

  const updateDisputeStatus = async (disputeId: string, status: string) => {
    await supabase.from("disputes").update({ status, resolved_at: status.startsWith("resolved") ? new Date().toISOString() : null }).eq("id", disputeId);
    setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status } : d));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have admin privileges.</p>
            <Button className="mt-4" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-8">Admin Dashboard</h1>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <Flag className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-2xl font-bold">{moderationLogs.length}</p>
              <p className="text-sm text-muted-foreground">Flagged Content</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{violators.length}</p>
              <p className="text-sm text-muted-foreground">Users with Violations</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
              <p className="text-2xl font-bold">{disputes.filter(d => d.status === "open").length}</p>
              <p className="text-sm text-muted-foreground">Open Disputes</p>
            </div>
          </div>

          <Tabs defaultValue="flagged">
            <TabsList className="mb-6">
              <TabsTrigger value="flagged">Flagged Content</TabsTrigger>
              <TabsTrigger value="users">User Violations</TabsTrigger>
              <TabsTrigger value="disputes">Disputes</TabsTrigger>
            </TabsList>

            <TabsContent value="flagged">
              {moderationLogs.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground"><Eye className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No flagged content</p></div>
              ) : (
                <div className="space-y-3">
                  {moderationLogs.map(log => (
                    <div key={log.id} className="bg-card rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{log.content_type}</Badge>
                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                          </div>
                          <p className="text-sm text-destructive font-medium">{log.violation_reason}</p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">{log.raw_content?.substring(0, 100)}</p>
                        </div>
                        <Badge variant="secondary">{(log.confidence * 100).toFixed(0)}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="users">
              {violators.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground"><UserX className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No violations</p></div>
              ) : (
                <div className="space-y-3">
                  {violators.map(v => (
                    <div key={v.user_id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">User: {v.user_id.substring(0, 8)}...</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{v.total_violations} violations</span>
                          {v.last_violation_at && <span>Last: {formatDistanceToNow(new Date(v.last_violation_at), { addSuffix: true })}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={v.is_suspended ? "destructive" : "secondary"}>
                          {v.is_suspended ? "Suspended" : "Active"}
                        </Badge>
                        <Button size="sm" variant={v.is_suspended ? "default" : "destructive"} onClick={() => toggleSuspension(v.user_id, v.is_suspended)}>
                          {v.is_suspended ? "Unban" : "Ban"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="disputes">
              {disputes.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground"><AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No disputes</p></div>
              ) : (
                <div className="space-y-3">
                  {disputes.map(d => (
                    <div key={d.id} className="bg-card rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={d.status === "open" ? "destructive" : "secondary"}>{d.status}</Badge>
                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
                          </div>
                          <p className="text-sm font-medium">{d.reason}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {d.contract?.client?.full_name} vs {d.contract?.freelancer?.full_name}
                          </p>
                        </div>
                        {d.status === "open" && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => updateDisputeStatus(d.id, "resolved_client")}>Favor Client</Button>
                            <Button size="sm" variant="outline" onClick={() => updateDisputeStatus(d.id, "resolved_freelancer")}>Favor Expert</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
