import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatNaira } from "@/lib/nigerian-data";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2, Search, Trophy, Eye, Trash2, Ban, CheckCircle2, Clock, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
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
  created_at: string;
  visibility: string;
  client_id: string;
  profiles: { full_name: string | null; email: string; username: string | null } | null;
  entry_count?: number;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  selecting_winners: { label: "Selecting Winners", variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

// Compute effective status: if DB says "active" but deadline has passed, it's really "selecting_winners"
const getEffectiveStatus = (contest: { status: string; deadline: string }) => {
  if (contest.status === "active" && new Date(contest.deadline) < new Date()) {
    return "selecting_winners";
  }
  return contest.status;
};

export default function AdminContests() {
  const { user } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);

  useEffect(() => {
    fetchContests();
  }, []);

  const fetchContests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contests")
      .select("id, title, status, category, deadline, prize_first, prize_second, prize_third, created_at, visibility, client_id, profiles!contests_client_id_fkey(full_name, email, username)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load contests");
      setLoading(false);
      return;
    }

    // Fetch entry counts
    const withCounts = await Promise.all(
      (data || []).map(async (c: any) => {
        const { data: countData } = await supabase.rpc("get_contest_entry_count", { _contest_id: c.id });
        return { ...c, entry_count: countData || 0 };
      })
    );

    setContests(withCounts);
    setLoading(false);
  };

  const updateContestStatus = async (contestId: string, newStatus: string) => {
    const { error } = await supabase
      .from("contests")
      .update({ status: newStatus })
      .eq("id", contestId);

    if (error) {
      toast.error("Failed to update contest status");
      return;
    }

    // Log activity
    if (user) {
      await supabase.from("admin_activity_log").insert({
        admin_id: user.id,
        action: `Changed contest status to ${newStatus}`,
        target_type: "contest",
        target_id: contestId,
      });
    }

    toast.success(`Contest status updated to ${newStatus}`);
    fetchContests();
  };

  const deleteContest = async (contestId: string) => {
    // Delete entries first, then the contest
    await supabase.from("contest_entries").delete().eq("contest_id", contestId);
    await supabase.from("contest_comments").delete().eq("contest_id", contestId);
    await supabase.from("contest_follows").delete().eq("contest_id", contestId);

    const { error } = await supabase.from("contests").delete().eq("id", contestId);

    if (error) {
      toast.error("Failed to delete contest");
      return;
    }

    if (user) {
      await supabase.from("admin_activity_log").insert({
        admin_id: user.id,
        action: "Deleted contest",
        target_type: "contest",
        target_id: contestId,
      });
    }

    toast.success("Contest deleted");
    setSelectedContest(null);
    fetchContests();
  };

  const totalPrize = (c: Contest) =>
    (c.prize_first || 0) + (c.prize_second || 0) + (c.prize_third || 0);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contests</h1>
          <p className="text-sm text-muted-foreground">{contests.length} total contests</p>
        </div>
      </div>

      {/* Filters */}
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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="selecting_winners">Selecting Winners</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
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
                const cfg = statusConfig[contest.status] || { label: contest.status, variant: "outline" as const };
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
                          <p className="text-xs text-muted-foreground">@{contest.profiles.username}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell>{contest.entry_count}</TableCell>
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
                        {contest.status === "active" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => updateContestStatus(contest.id, "cancelled")}
                            title="Cancel contest"
                          >
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
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

      {/* Detail Dialog */}
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
                    <p className="text-xs text-muted-foreground">@{selectedContest.profiles.username}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={statusConfig[selectedContest.status]?.variant || "outline"}>
                    {statusConfig[selectedContest.status]?.label || selectedContest.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entries</p>
                  <p className="text-sm font-medium">{selectedContest.entry_count}</p>
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
                  <p className="text-sm">{format(new Date(selectedContest.created_at!), "MMM d, yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="text-sm">{selectedContest.category || "—"}</p>
                </div>
              </div>

              {/* Prize Breakdown */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Prize Breakdown</p>
                <div className="flex gap-3">
                  <Badge variant="outline" className="gap-1">
                    <Trophy className="h-3 w-3 text-amber-500" /> 1st: {formatNaira(selectedContest.prize_first)}
                  </Badge>
                  {(selectedContest.prize_second ?? 0) > 0 && (
                    <Badge variant="outline">2nd: {formatNaira(selectedContest.prize_second!)}</Badge>
                  )}
                  {(selectedContest.prize_third ?? 0) > 0 && (
                    <Badge variant="outline">3rd: {formatNaira(selectedContest.prize_third!)}</Badge>
                  )}
                </div>
              </div>

              {/* Status Actions */}
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Change Status</p>
                <div className="flex flex-wrap gap-2">
                  {selectedContest.status !== "active" && (
                    <Button size="sm" variant="outline" onClick={() => { updateContestStatus(selectedContest.id, "active"); setSelectedContest(null); }}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Set Active
                    </Button>
                  )}
                  {selectedContest.status !== "selecting_winners" && (
                    <Button size="sm" variant="outline" onClick={() => { updateContestStatus(selectedContest.id, "selecting_winners"); setSelectedContest(null); }}>
                      <Clock className="h-4 w-4 mr-1" /> Selecting Winners
                    </Button>
                  )}
                  {selectedContest.status !== "completed" && (
                    <Button size="sm" variant="outline" onClick={() => { updateContestStatus(selectedContest.id, "completed"); setSelectedContest(null); }}>
                      <Trophy className="h-4 w-4 mr-1" /> Complete
                    </Button>
                  )}
                  {selectedContest.status !== "cancelled" && (
                    <Button size="sm" variant="destructive" onClick={() => { updateContestStatus(selectedContest.id, "cancelled"); setSelectedContest(null); }}>
                      <Ban className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
