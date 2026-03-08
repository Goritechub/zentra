import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DisputeAdjudicator } from "@/components/admin/DisputeAdjudicator";
import { Loader2, ArrowLeft, Gavel, Eye, AlertTriangle } from "lucide-react";

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("all");

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

  const filtered = disputes.filter(d => {
    if (statusFilter === "all") return true;
    return d.dispute_status === statusFilter;
  });

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

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Disputes Management</h1>

      <div className="flex items-center gap-4 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Disputes</SelectItem>
            <SelectItem value="awaiting_response">Awaiting Response</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filtered.length} disputes</Badge>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No disputes found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => {
            const dStatus = d.dispute_status || "awaiting_response";
            const statusVariant = dStatus === "awaiting_response" ? "destructive" : dStatus === "under_review" ? "secondary" : "default";
            const statusLabel = dStatus === "awaiting_response" ? "Awaiting Response" : dStatus === "under_review" ? "Under Review" : "Resolved";
            return (
              <div key={d.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={statusVariant as any}>{statusLabel}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm font-medium">{d.reason}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {d.contract?.client?.full_name} vs {d.contract?.freelancer?.full_name}
                    </p>
                  </div>
                  <Button size="sm" variant={dStatus !== "resolved" ? "default" : "outline"} onClick={() => setSelectedDispute(d)}>
                    {dStatus !== "resolved" ? <><Gavel className="h-3 w-3 mr-1" /> Review</> : <><Eye className="h-3 w-3 mr-1" /> View</>}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
