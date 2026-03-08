import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DisputeAdjudicator } from "@/components/admin/DisputeAdjudicator";
import { Loader2, ArrowLeft, Gavel, Eye, AlertTriangle, History } from "lucide-react";

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);

  useEffect(() => { fetchDisputes(); }, []);

  const fetchDisputes = async () => {
    const { data } = await supabase
      .from("disputes")
      .select("*, contract:contracts!disputes_contract_id_fkey(*, client:profiles!contracts_client_id_fkey(full_name), freelancer:profiles!contracts_freelancer_id_fkey(full_name))")
      .order("created_at", { ascending: false })
      .limit(100);
    setDisputes(data || []);
    setLoading(false);
  };

  const activeDisputes = disputes.filter(d => d.dispute_status !== "resolved");
  const resolvedDisputes = disputes.filter(d => d.dispute_status === "resolved");

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (selectedDispute) {
    return (
      <div>
        <Button variant="ghost" onClick={() => setSelectedDispute(null)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Disputes
        </Button>
        <DisputeAdjudicator dispute={selectedDispute} onResolved={() => { setSelectedDispute(null); fetchDisputes(); }} />
      </div>
    );
  }

  const renderDisputeCard = (d: any) => {
    const dStatus = d.dispute_status || "awaiting_response";
    const statusVariant = dStatus === "awaiting_response" ? "destructive" : dStatus === "under_review" ? "secondary" : "default";
    const statusLabel = dStatus === "awaiting_response" ? "Awaiting Response" : dStatus === "under_review" ? "Under Review" : "Resolved";
    return (
      <div key={d.id} className="bg-card rounded-xl border border-border p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant={statusVariant as any}>{statusLabel}</Badge>
              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
            </div>
            <p className="text-sm font-medium truncate">{d.reason}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {d.contract?.client?.full_name} vs {d.contract?.freelancer?.full_name}
            </p>
            {dStatus === "resolved" && d.resolution_type && (
              <p className="text-xs text-muted-foreground mt-1">
                Resolution: {d.resolution_type === "release_to_freelancer" ? "Released to Expert" : d.resolution_type === "refund_client" ? "Refunded to Client" : d.resolution_type === "partial_split" ? "Partial Split" : "Closed (No Funds)"}
              </p>
            )}
          </div>
          <Button size="sm" variant={dStatus !== "resolved" ? "default" : "outline"} onClick={() => setSelectedDispute(d)} className="w-full sm:w-auto shrink-0">
            {dStatus !== "resolved" ? <><Gavel className="h-3 w-3 mr-1" /> Review</> : <><Eye className="h-3 w-3 mr-1" /> View</>}
          </Button>
        </div>
      </div>
    );
  };

  const emptyState = (icon: React.ReactNode, text: string) => (
    <div className="text-center py-16 text-muted-foreground">
      {icon}
      <p>{text}</p>
    </div>
  );

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Disputes Management</h1>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-full sm:w-auto mb-6">
          <TabsTrigger value="active" className="flex-1 sm:flex-none">
            Active {activeDisputes.length > 0 && <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5">{activeDisputes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="resolved" className="flex-1 sm:flex-none">
            <History className="h-3.5 w-3.5 mr-1.5" /> History ({resolvedDisputes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {activeDisputes.length === 0
            ? emptyState(<AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />, "No active disputes")
            : <div className="space-y-3">{activeDisputes.map(renderDisputeCard)}</div>
          }
        </TabsContent>

        <TabsContent value="resolved">
          {resolvedDisputes.length === 0
            ? emptyState(<History className="h-12 w-12 mx-auto mb-4 opacity-50" />, "No resolved disputes yet")
            : <div className="space-y-3">{resolvedDisputes.map(renderDisputeCard)}</div>
          }
        </TabsContent>
      </Tabs>
    </div>
  );
}
