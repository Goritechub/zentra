import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatDistanceToNow, format } from "date-fns";
import { getAdminQuotes, updateAdminQuoteStatus } from "@/api/quotes.api";
import type { QuoteRequest } from "@/types/quotes";
import { toast } from "sonner";

const STATUSES = ["new", "in_review", "quoted", "closed"];
const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  new: { label: "New", variant: "default" },
  in_review: { label: "In Review", variant: "secondary" },
  quoted: { label: "Quoted", variant: "outline" },
  closed: { label: "Closed", variant: "destructive" },
};

export default function AdminQuoteRequests() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<QuoteRequest | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchQuotes = useCallback(async () => {
    const data = await getAdminQuotes(statusFilter === "all" ? undefined : statusFilter);
    setQuotes(data.quotes || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateAdminQuoteStatus(id, { status: newStatus });
      toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label}`);
      fetchQuotes();
      if (selected?.id === id) setSelected({ ...selected, status: newStatus });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    try {
      await updateAdminQuoteStatus(selected.id, { admin_notes: notesDraft });
      toast.success("Notes saved.");
      setSelected({ ...selected, admin_notes: notesDraft });
      fetchQuotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save notes.");
    } finally {
      setSavingNotes(false);
    }
  };

  const openDetail = (q: QuoteRequest) => {
    setSelected(q);
    setNotesDraft(q.admin_notes || "");
  };

  const filtered = quotes.filter((q) =>
    !searchQuery ||
    q.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Quote Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">{quotes.length} request(s)</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by title, name, email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState variant="documents" title="No quote requests found" />
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => (
            <button
              key={q.id}
              onClick={() => openDetail(q)}
              className="w-full text-left bg-card rounded-xl border border-border p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground truncate">{q.title}</p>
                    <Badge variant={STATUS_CONFIG[q.status]?.variant || "outline"} className="text-xs shrink-0">
                      {STATUS_CONFIG[q.status]?.label || q.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{q.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {q.contact_name} ({q.contact_email}) • {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quote Request Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Project Title</Label>
                <p className="font-semibold text-foreground">{selected.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Contact</Label>
                  <p className="text-sm">{selected.contact_name}</p>
                  <p className="text-sm text-muted-foreground">{selected.contact_email}</p>
                  {selected.contact_phone && <p className="text-sm text-muted-foreground">{selected.contact_phone}</p>}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div><Badge variant={STATUS_CONFIG[selected.status]?.variant || "outline"} className="mt-1">{STATUS_CONFIG[selected.status]?.label}</Badge></div>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Budget</Label>
                  <p className="text-sm">
                    {selected.budget_min || selected.budget_max
                      ? `₦${selected.budget_min ?? "?"} – ₦${selected.budget_max ?? "?"}`
                      : "Not specified"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Delivery</Label>
                  <p className="text-sm">{selected.delivery_days ? `${selected.delivery_days} days` : "Not specified"}</p>
                </div>
              </div>
              {selected.required_software?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Required Software</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selected.required_software.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                  </div>
                </div>
              )}
              {selected.attachments?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Attachments</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selected.attachments.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Submitted</Label>
                <p className="text-sm">{format(new Date(selected.created_at), "PPp")}</p>
              </div>

              <div className="space-y-2">
                <Label>Update Status</Label>
                <div className="flex gap-2 flex-wrap">
                  {STATUSES.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={selected.status === s ? "default" : "outline"}
                      onClick={() => updateStatus(selected.id, s)}
                      disabled={selected.status === s}
                    >
                      {STATUS_CONFIG[s].label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea rows={3} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Internal notes..." />
                <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                  {savingNotes ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Notes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
