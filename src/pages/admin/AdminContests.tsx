import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  deleteAdminContest,
  getAdminContests,
  updateAdminContestStatus,
  getAdminPendingContests,
  approveAdminContest,
  rejectAdminContest,
  getAdminCancellationRequests,
  approveAdminCancellationRequest,
  rejectAdminCancellationRequest,
} from "@/api/admin.api";
import { formatNaira } from "@/lib/nigerian-data";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2, Search, Trophy, Eye, Trash2, Ban, CheckCircle2, Clock,
  AlertTriangle, XCircle, RefreshCw, ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

interface Contest {
  id: string;
  title: string;
  status: string;
  category: string | null;
  deadline: string;
  prize_first: number;
  prize_second: number | null;
  prize_third: number | null;
  prize_fourth: number | null;
  prize_fifth: number | null;
  created_at: string;
  visibility: string;
  client_id: string;
  description?: string;
  rules?: string | null;
  banner_image?: string | null;
  review_message?: string | null;
  profiles: { full_name: string | null; email: string; username: string | null; avatar_url?: string | null } | null;
  entry_count?: number;
  winner_count?: number;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  pending_review: { label: "Under Review", variant: "outline" },
  rejected: { label: "Rejected", variant: "destructive" },
  selecting_winners: { label: "Selecting Winners", variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  cancellation_requested: { label: "Cancellation Requested", variant: "outline" },
};

const getEffectiveStatus = (contest: { status: string; deadline: string; winner_count?: number }) => {
  if (["completed", "cancelled", "pending_review", "rejected", "cancellation_requested"].includes(contest.status)) return contest.status;
  const deadlinePassed = new Date(contest.deadline) < new Date();
  const hasWinners = (contest.winner_count || 0) > 0;
  if (hasWinners) return "completed";
  if (deadlinePassed) return "selecting_winners";
  return contest.status;
};

const totalPrize = (c: Contest) =>
  (c.prize_first || 0) + (c.prize_second || 0) + (c.prize_third || 0) +
  (c.prize_fourth || 0) + (c.prize_fifth || 0);

export default function AdminContests() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [pendingContests, setPendingContests] = useState<Contest[]>([]);
  const [cancellationRequests, setCancellationRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);

  // Reject contest dialog
  const [rejectTarget, setRejectTarget] = useState<Contest | null>(null);
  const [rejectMessage, setRejectMessage] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Reject cancellation dialog
  const [rejectCancelTarget, setRejectCancelTarget] = useState<any>(null);
  const [rejectCancelMessage, setRejectCancelMessage] = useState("");
  const [rejectingCancel, setRejectingCancel] = useState(false);

  useEffect(() => {
    void fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [allData, pendingData, cancelData] = await Promise.all([
        getAdminContests(),
        getAdminPendingContests(),
        getAdminCancellationRequests(),
      ]);
      setContests((allData.contests as Contest[]) || []);
      setPendingContests((pendingData.contests as Contest[]) || []);
      setCancellationRequests(cancelData.requests || []);
    } catch {
      toast.error("Failed to load contests");
    } finally {
      setLoading(false);
    }
  };

  const updateContestStatus = async (contestId: string, newStatus: string) => {
    try {
      await updateAdminContestStatus(contestId, newStatus);
      toast.success(`Contest status updated to ${newStatus}`);
      void fetchAll();
    } catch {
      toast.error("Failed to update contest status");
    }
  };

  const handleApproveContest = async (contestId: string) => {
    try {
      await approveAdminContest(contestId);
      toast.success("Contest approved and is now live");
      void fetchAll();
    } catch {
      toast.error("Failed to approve contest");
    }
  };

  const handleRejectContest = async () => {
    if (!rejectTarget || !rejectMessage.trim()) return;
    setRejecting(true);
    try {
      await rejectAdminContest(rejectTarget.id, rejectMessage.trim());
      toast.success("Contest rejected. Client has been notified.");
      setRejectTarget(null);
      setRejectMessage("");
      void fetchAll();
    } catch {
      toast.error("Failed to reject contest");
    } finally {
      setRejecting(false);
    }
  };

  const handleApproveCancellation = async (requestId: string) => {
    try {
      await approveAdminCancellationRequest(requestId);
      toast.success("Cancellation approved. Prize pool refunded to client.");
      void fetchAll();
    } catch {
      toast.error("Failed to approve cancellation");
    }
  };

  const handleRejectCancellation = async () => {
    if (!rejectCancelTarget || !rejectCancelMessage.trim()) return;
    setRejectingCancel(true);
    try {
      await rejectAdminCancellationRequest(rejectCancelTarget.id, rejectCancelMessage.trim());
      toast.success("Cancellation rejected. Contest restored to active.");
      setRejectCancelTarget(null);
      setRejectCancelMessage("");
      void fetchAll();
    } catch {
      toast.error("Failed to reject cancellation");
    } finally {
      setRejectingCancel(false);
    }
  };

  const deleteContest = async (contestId: string) => {
    try {
      await deleteAdminContest(contestId);
      toast.success("Contest deleted");
      setSelectedContest(null);
      void fetchAll();
    } catch {
      toast.error("Failed to delete contest");
    }
  };

  const filtered = contests.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.profiles?.username?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || getEffectiveStatus(c) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingCount = pendingContests.length;
  const cancelCount = cancellationRequests.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contests</h1>
          <p className="text-sm text-muted-foreground">{contests.length} total contests</p>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Contests</TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            Pending Review
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white font-bold">{pendingCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cancellations" className="relative">
            Cancellation Requests
            {cancelCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">{cancelCount}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── ALL CONTESTS ─────────────────────────────────────── */}
        <TabsContent value="all">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, host name or username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending_review">Under Review</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancellation_requested">Cancellation Requested</SelectItem>
                <SelectItem value="selecting_winners">Selecting Winners</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Prize Pool</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No contests found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((contest) => {
                    const effectiveStatus = getEffectiveStatus(contest);
                    const cfg = statusConfig[effectiveStatus] || { label: effectiveStatus, variant: "outline" as const };
                    return (
                      <TableRow key={contest.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground line-clamp-1">{contest.title}</p>
                            {contest.category && (
                              <p className="text-xs text-muted-foreground">{contest.category}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{contest.profiles?.full_name || "—"}</p>
                            {contest.profiles?.username && (
                              <Link to={`/client/${contest.client_id}/profile`} className="text-xs text-muted-foreground hover:text-primary hover:underline">
                                @{contest.profiles.username}
                              </Link>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell>{contest.entry_count ?? "—"}</TableCell>
                        <TableCell>{formatNaira(totalPrize(contest))}</TableCell>
                        <TableCell>
                          <p className="text-sm">{format(new Date(contest.deadline), "MMM d, yyyy")}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedContest(contest)}
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Delete contest">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Contest</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete "{contest.title}" and all its entries. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteContest(contest.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── PENDING REVIEW ───────────────────────────────────── */}
        <TabsContent value="pending">
          {pendingContests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No contests awaiting review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingContests.map((contest) => (
                <div key={contest.id} className="rounded-xl border border-amber-300/50 bg-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{contest.title}</h3>
                        {contest.category && <Badge variant="outline" className="text-xs">{contest.category}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{contest.description}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Client</p>
                          <p className="font-medium">{contest.profiles?.full_name || "—"}</p>
                          {contest.profiles?.username && (
                            <Link to={`/client/${contest.client_id}/profile`} className="text-xs text-muted-foreground hover:text-primary hover:underline">
                              @{contest.profiles.username}
                            </Link>
                          )}
                          {contest.profiles?.email && <p className="text-xs text-muted-foreground">{contest.profiles.email}</p>}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Prize Pool</p>
                          <p className="font-medium text-primary">{formatNaira(totalPrize(contest))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Deadline</p>
                          <p>{format(new Date(contest.deadline), "MMM d, yyyy")}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Submitted</p>
                          <p>{format(new Date(contest.created_at), "MMM d, yyyy")}</p>
                        </div>
                      </div>
                      {contest.rules && (
                        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm mb-2">
                          <span className="font-medium text-xs text-muted-foreground block mb-0.5">Rules</span>
                          <p className="line-clamp-2">{contest.rules}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleApproveContest(contest.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { setRejectTarget(contest); setRejectMessage(""); }}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── CANCELLATION REQUESTS ────────────────────────────── */}
        <TabsContent value="cancellations">
          {cancellationRequests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No pending cancellation requests</p>
            </div>
          ) : (
            <div className="space-y-6">
              {cancellationRequests.map((req: any) => {
                const contest = req.contest as any;
                const pool = (contest?.prize_first || 0) + (contest?.prize_second || 0) +
                  (contest?.prize_third || 0) + (contest?.prize_fourth || 0) +
                  (contest?.prize_fifth || 0);
                return (
                  <div key={req.id} className="rounded-xl border border-orange-300/50 bg-card p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-foreground">{contest?.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          By {req.client?.full_name || "—"}{req.client?.username ? ` (@${req.client.username})` : ""} · {req.entry_count} entr{req.entry_count !== 1 ? "ies" : "y"}
                        </p>
                        {req.client?.email && (
                          <p className="text-xs text-muted-foreground">{req.client.email}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-primary">{formatNaira(pool)}</p>
                        <p className="text-xs text-muted-foreground">prize pool</p>
                      </div>
                    </div>

                    {/* Client wallet info */}
                    {req.client_wallet && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
                          <p className="text-muted-foreground mb-0.5">Wallet balance</p>
                          <p className="font-semibold">{formatNaira(req.client_wallet.balance ?? 0)}</p>
                        </div>
                        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
                          <p className="text-muted-foreground mb-0.5">In escrow</p>
                          <p className="font-semibold">{formatNaira(req.client_wallet.escrow_balance ?? 0)}</p>
                        </div>
                        {req.client_wallet.total_earned != null && (
                          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
                            <p className="text-muted-foreground mb-0.5">Total spent</p>
                            <p className="font-semibold">{formatNaira(req.client_wallet.total_earned ?? 0)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reason */}
                    <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      <span className="font-medium">Reason: </span>{req.reason}
                      {req.note && <span className="text-muted-foreground"> — "{req.note}"</span>}
                    </div>

                    {/* Client recent transactions */}
                    {req.client_recent_transactions?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Client's recent transactions</p>
                        <div className="space-y-1">
                          {req.client_recent_transactions.map((tx: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs rounded bg-muted/30 px-2 py-1">
                              <span className="text-muted-foreground truncate max-w-[200px]">{tx.description}</span>
                              <span className={tx.type === "credit" ? "text-emerald-600 font-medium" : "text-foreground font-medium"}>
                                {tx.type === "credit" ? "+" : "-"}{formatNaira(tx.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Approve & Refund
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Approve Cancellation</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will cancel the contest "{contest?.title}" and refund {formatNaira(pool)} to the client's wallet. All entrants will be notified.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Back</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => handleApproveCancellation(req.id)}
                            >
                              Confirm Approval
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { setRejectCancelTarget(req); setRejectCancelMessage(""); }}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject Request
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog (all contests tab) */}
      <Dialog open={!!selectedContest} onOpenChange={() => setSelectedContest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Contest Details</DialogTitle>
          </DialogHeader>
          {selectedContest && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Title</p>
                <p className="font-medium">{selectedContest.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Host</p>
                  <p className="text-sm">{selectedContest.profiles?.full_name || "—"}</p>
                  {selectedContest.profiles?.username && (
                    <Link to={`/client/${selectedContest.client_id}/profile`} className="text-xs text-muted-foreground hover:text-primary hover:underline">
                      @{selectedContest.profiles.username}
                    </Link>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {(() => {
                    const es = getEffectiveStatus(selectedContest);
                    return (
                      <Badge variant={statusConfig[es]?.variant || "outline"}>
                        {statusConfig[es]?.label || es}
                      </Badge>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entries</p>
                  <p className="text-sm font-medium">{selectedContest.entry_count ?? "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Visibility</p>
                  <p className="text-sm capitalize">{selectedContest.visibility}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prize Pool</p>
                  <p className="text-sm font-medium">{formatNaira(totalPrize(selectedContest))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Deadline</p>
                  <p className="text-sm">{format(new Date(selectedContest.deadline), "MMM d, yyyy h:mm a")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm">{format(new Date(selectedContest.created_at), "MMM d, yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="text-sm">{selectedContest.category || "—"}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Prize Breakdown</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Trophy className="h-3 w-3 text-amber-500" /> 1st: {formatNaira(selectedContest.prize_first)}
                  </Badge>
                  {(selectedContest.prize_second ?? 0) > 0 && (
                    <Badge variant="outline">2nd: {formatNaira(selectedContest.prize_second!)}</Badge>
                  )}
                  {(selectedContest.prize_third ?? 0) > 0 && (
                    <Badge variant="outline">3rd: {formatNaira(selectedContest.prize_third!)}</Badge>
                  )}
                  {(selectedContest.prize_fourth ?? 0) > 0 && (
                    <Badge variant="outline">4th: {formatNaira(selectedContest.prize_fourth!)}</Badge>
                  )}
                  {(selectedContest.prize_fifth ?? 0) > 0 && (
                    <Badge variant="outline">5th: {formatNaira(selectedContest.prize_fifth!)}</Badge>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Change Status</p>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const es = getEffectiveStatus(selectedContest);
                    return (
                      <>
                        {es !== "active" && (
                          <Button size="sm" variant="outline" onClick={() => { updateContestStatus(selectedContest.id, "active"); setSelectedContest(null); }}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Set Active
                          </Button>
                        )}
                        {es !== "selecting_winners" && (
                          <Button size="sm" variant="outline" onClick={() => { updateContestStatus(selectedContest.id, "selecting_winners"); setSelectedContest(null); }}>
                            <Clock className="h-4 w-4 mr-1" /> Selecting Winners
                          </Button>
                        )}
                        {es !== "completed" && (
                          <Button size="sm" variant="outline" onClick={() => { updateContestStatus(selectedContest.id, "completed"); setSelectedContest(null); }}>
                            <Trophy className="h-4 w-4 mr-1" /> Complete
                          </Button>
                        )}
                        {es !== "cancelled" && (
                          <Button size="sm" variant="destructive" onClick={() => { updateContestStatus(selectedContest.id, "cancelled"); setSelectedContest(null); }}>
                            <Ban className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject contest dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectMessage(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Contest</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting "{rejectTarget?.title}". The prize pool will be refunded and the client can edit and resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-msg">Rejection reason <span className="text-destructive">*</span></Label>
            <Textarea
              id="reject-msg"
              placeholder="e.g. Contest description is too vague, please provide specific deliverables..."
              value={rejectMessage}
              onChange={(e) => setRejectMessage(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectMessage(""); }} disabled={rejecting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectContest} disabled={rejecting || !rejectMessage.trim()}>
              {rejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Reject Contest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject cancellation dialog */}
      <Dialog open={!!rejectCancelTarget} onOpenChange={(open) => { if (!open) { setRejectCancelTarget(null); setRejectCancelMessage(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Cancellation Request</DialogTitle>
            <DialogDescription>
              The contest will be restored to active. Provide a message for the client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-cancel-msg">Message to client <span className="text-destructive">*</span></Label>
            <Textarea
              id="reject-cancel-msg"
              placeholder="e.g. As per our T&C, contests with active entries cannot be cancelled unless entries are clearly in violation..."
              value={rejectCancelMessage}
              onChange={(e) => setRejectCancelMessage(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectCancelTarget(null); setRejectCancelMessage(""); }} disabled={rejectingCancel}>
              Back
            </Button>
            <Button variant="destructive" onClick={handleRejectCancellation} disabled={rejectingCancel || !rejectCancelMessage.trim()}>
              {rejectingCancel ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send & Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
