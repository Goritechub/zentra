import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { formatNaira } from "@/lib/nigerian-data";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Eye, Trash2, FileText } from "lucide-react";

export default function AdminJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<any>(null);

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("*, client:profiles!jobs_client_id_fkey(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(500);
    setJobs(data || []);
    setLoading(false);
  };

  const viewJob = async (job: any) => {
    setSelectedJob(job);
    const { data } = await supabase
      .from("proposals")
      .select("*, freelancer:profiles!proposals_freelancer_id_fkey(full_name, email)")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false });
    setProposals(data || []);
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job? This will also remove all proposals and related data.")) return;
    // Clean up related data first
    await Promise.all([
      supabase.from("proposals").delete().eq("job_id", jobId),
      supabase.from("job_views").delete().eq("job_id", jobId),
    ]);
    const { error } = await supabase.from("jobs").delete().eq("id", jobId);
    if (error) {
      toast.error("Failed to delete job");
      return;
    }
    await supabase.from("admin_activity_log").insert({
      admin_id: user!.id, action: "delete_job", target_type: "job", target_id: jobId, details: {},
    });
    setJobs(prev => prev.filter(j => j.id !== jobId));
    setSelectedJob(null);
    toast.success("Job deleted");
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "open": return "default";
      case "in_progress": return "secondary";
      case "completed": return "outline";
      case "cancelled": return "destructive";
      default: return "outline" as const;
    }
  };

  const filtered = jobs.filter(j => {
    const matchSearch = !search || j.title?.toLowerCase().includes(search.toLowerCase()) || j.client?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Jobs Management</h1>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filtered.length} jobs</Badge>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Posted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(j => (
              <TableRow key={j.id}>
                <TableCell className="font-medium max-w-[200px] truncate">{j.title}</TableCell>
                <TableCell className="text-sm">{j.client?.full_name || "—"}</TableCell>
                <TableCell className="text-sm">
                  {j.budget_min && j.budget_max
                    ? `${formatNaira(j.budget_min)} - ${formatNaira(j.budget_max)}`
                    : j.budget_max ? formatNaira(j.budget_max) : "Negotiable"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusColor(j.status) as any} className="capitalize">{j.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => viewJob(j)}><Eye className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteJob(j.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Job Detail Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedJob?.title}</DialogTitle>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="text-sm whitespace-pre-wrap text-muted-foreground">{selectedJob.description}</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>Client: <span className="font-medium">{selectedJob.client?.full_name}</span></div>
                <div>Status: <Badge variant={statusColor(selectedJob.status) as any} className="capitalize">{selectedJob.status}</Badge></div>
                <div>Visibility: <span className="font-medium capitalize">{selectedJob.visibility}</span></div>
                <div>Duration: <span className="font-medium">{selectedJob.delivery_days} {selectedJob.delivery_unit}</span></div>
              </div>

              {proposals.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Proposals ({proposals.length})
                  </h4>
                  <div className="space-y-2">
                    {proposals.map(p => (
                      <div key={p.id} className="border border-border rounded-lg p-3 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{p.freelancer?.full_name}</span>
                          <Badge variant="outline" className="capitalize">{p.status}</Badge>
                        </div>
                        <div className="flex gap-4 mt-1 text-muted-foreground text-xs">
                          <span>Bid: {formatNaira(p.bid_amount)}</span>
                          <span>Delivery: {p.delivery_days} {p.delivery_unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
