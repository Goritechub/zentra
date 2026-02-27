import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { isPast, format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, Trophy, Calendar, Users, FileText, Award, Upload, Eye, Lock
} from "lucide-react";

export default function ContestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [contest, setContest] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [winners, setWinners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submissionDesc, setSubmissionDesc] = useState("");
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [winnerSelections, setWinnerSelections] = useState<Record<number, string>>({});
  const [selectingWinners, setSelectingWinners] = useState(false);

  const isClient = profile?.role === "client";
  const isExpert = profile?.role === "freelancer";

  useEffect(() => {
    if (id) fetchContest();
  }, [id]);

  const fetchContest = async () => {
    const { data } = await supabase
      .from("contests" as any)
      .select("*, client:profiles!contests_client_id_fkey(full_name, avatar_url)")
      .eq("id", id)
      .single();
    setContest(data);

    const { data: entriesData } = await supabase
      .from("contest_entries")
      .select("*, freelancer:profiles!contest_entries_freelancer_id_fkey(full_name, avatar_url)")
      .eq("contest_id", id!)
      .order("created_at", { ascending: false });
    
    const allEntries = (entriesData as any[]) || [];
    setEntries(allEntries.filter(e => !e.is_winner));
    setWinners(allEntries.filter(e => e.is_winner).sort((a, b) => (a.prize_position || 99) - (b.prize_position || 99)));
    setLoading(false);
  };

  const ended = contest ? (isPast(new Date(contest.deadline)) || contest.status === "ended") : false;
  const isOpen = contest?.visibility === "open";
  const isOwner = contest?.client_id === user?.id;
  const totalPrize = contest ? (contest.prize_first || 0) + (contest.prize_second || 0) + (contest.prize_third || 0) : 0;
  const hasAlreadyEntered = entries.some(e => e.freelancer_id === user?.id) || winners.some(e => e.freelancer_id === user?.id);

  const handleSubmitEntry = async () => {
    if (!submissionDesc.trim()) { toast.error("Please add a description"); return; }
    setSubmitting(true);

    const urls: string[] = [];
    for (const file of submissionFiles) {
      const path = `entries/${user!.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("contest-banners").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("contest-banners").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }

    const { error } = await supabase.from("contest_entries").insert({
      contest_id: id,
      freelancer_id: user!.id,
      description: submissionDesc.trim(),
      attachments: urls,
    });

    if (error) toast.error("Failed to submit entry");
    else {
      toast.success("Entry submitted!");
      setShowSubmitDialog(false);
      setSubmissionDesc("");
      setSubmissionFiles([]);
      fetchContest();
    }
    setSubmitting(false);
  };

  const handleSelectWinners = async () => {
    if (!winnerSelections[1]) { toast.error("Please select at least a 1st place winner"); return; }
    setSelectingWinners(true);

    for (const [pos, entryId] of Object.entries(winnerSelections)) {
      if (!entryId) continue;
      await supabase.from("contest_entries")
        .update({ is_winner: true, prize_position: parseInt(pos) } as any)
        .eq("id", entryId);
    }

    await supabase.from("contests" as any).update({ status: "ended" }).eq("id", id);
    toast.success("Winners selected!");
    setShowWinnerDialog(false);
    fetchContest();
    setSelectingWinners(false);
  };

  if (loading) {
    return <div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div><Footer /></div>;
  }

  if (!contest) {
    return <div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><p>Contest not found</p></div><Footer /></div>;
  }

  const allEntries = [...entries, ...winners];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide max-w-4xl">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>

          {/* Banner */}
          <div className="h-48 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 relative">
            {contest.banner_image ? (
              <img src={contest.banner_image} alt={contest.title} className="w-full h-full object-cover" />
            ) : (
              <Trophy className="h-20 w-20 text-primary/30" />
            )}
            <Badge variant={ended ? "secondary" : "default"} className="absolute top-4 right-4 text-sm">
              {ended ? "Ended" : "Active"}
            </Badge>
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{contest.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">by {(contest.client as any)?.full_name || "Client"}</p>
              {contest.category && <Badge variant="outline" className="mt-2">{contest.category}</Badge>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{formatNaira(totalPrize)}</p>
              <p className="text-xs text-muted-foreground">Total Prize Pool</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            {isExpert && !ended && !hasAlreadyEntered && (
              <Button onClick={() => setShowSubmitDialog(true)}>
                <Upload className="h-4 w-4 mr-2" /> Submit Entry
              </Button>
            )}
            {hasAlreadyEntered && (
              <Badge variant="secondary" className="py-2 px-4">✓ You've entered this contest</Badge>
            )}
            {isOwner && !ended && allEntries.length > 0 && (
              <Button variant="outline" onClick={() => setShowWinnerDialog(true)}>
                <Award className="h-4 w-4 mr-2" /> Select Winners
              </Button>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="description">
            <TabsList className="mb-6">
              <TabsTrigger value="description"><FileText className="h-4 w-4 mr-1.5" /> Description</TabsTrigger>
              <TabsTrigger value="entries"><Users className="h-4 w-4 mr-1.5" /> Entries ({allEntries.length})</TabsTrigger>
              <TabsTrigger value="winners"><Award className="h-4 w-4 mr-1.5" /> Winners</TabsTrigger>
            </TabsList>

            <TabsContent value="description">
              <div className="bg-card rounded-xl border border-border p-6 space-y-6">
                <div>
                  <h2 className="font-semibold text-foreground mb-2">Description</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contest.description}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Runtime</p>
                    <p className="font-medium text-foreground flex items-center gap-1.5 mt-1">
                      <Calendar className="h-4 w-4 text-primary" />
                      {ended ? "Contest has ended" : `${formatDistanceToNow(new Date(contest.deadline))} remaining`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Deadline: {format(new Date(contest.deadline), "PPP p")}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Visibility</p>
                    <p className="font-medium text-foreground mt-1">
                      {isOpen ? "Open Contest" : "Closed Contest"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isOpen ? "Entries visible to everyone" : "Only entry count shown"}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-2">Prize Breakdown</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between p-3 rounded-lg bg-accent/10">
                      <span>🥇 1st Place</span>
                      <span className="font-bold text-primary">{formatNaira(contest.prize_first)}</span>
                    </div>
                    {contest.prize_second > 0 && (
                      <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                        <span>🥈 2nd Place</span>
                        <span className="font-semibold">{formatNaira(contest.prize_second)}</span>
                      </div>
                    )}
                    {contest.prize_third > 0 && (
                      <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                        <span>🥉 3rd Place</span>
                        <span className="font-semibold">{formatNaira(contest.prize_third)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {contest.rules && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Rules / How to Enter</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contest.rules}</p>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold text-foreground mb-2">Winner Selection</h3>
                  <p className="text-sm text-muted-foreground">{contest.winner_selection_method === "client_selects" ? "Client selects winners" : contest.winner_selection_method || "Client selects winners"}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="entries">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground">Entries ({allEntries.length})</h2>
                </div>

                {allEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No entries yet</p>
                  </div>
                ) : !isOpen && !isOwner ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">{allEntries.length} entries submitted</p>
                    <p className="text-sm mt-1">This is a closed contest. Entry details are hidden.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allEntries.map((entry: any) => (
                      <div key={entry.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-foreground">{(entry.freelancer as any)?.full_name || "Expert"}</p>
                            <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
                            {entry.is_winner && (
                              <Badge variant="default" className="mt-2 bg-accent text-accent-foreground">
                                <Award className="h-3 w-3 mr-1" />
                                {entry.prize_position === 1 ? "1st" : entry.prize_position === 2 ? "2nd" : "3rd"} Place
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{format(new Date(entry.created_at), "MMM d, yyyy")}</p>
                        </div>
                        {entry.attachments?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {entry.attachments.map((url: string, i: number) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                <Eye className="h-3 w-3" /> Attachment {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="winners">
              <div className="bg-card rounded-xl border border-border p-6">
                {winners.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Winners will appear here when the contest ends.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {winners.map((w: any) => (
                      <div key={w.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                        <div className="text-3xl">
                          {w.prize_position === 1 ? "🥇" : w.prize_position === 2 ? "🥈" : "🥉"}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{(w.freelancer as any)?.full_name || "Expert"}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">{w.description}</p>
                        </div>
                        <p className="font-bold text-primary">
                          {formatNaira(w.prize_position === 1 ? contest.prize_first : w.prize_position === 2 ? contest.prize_second : contest.prize_third)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />

      {/* Submit Entry Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Contest Entry</DialogTitle>
            <DialogDescription>Describe your submission and attach relevant files.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              placeholder="Describe your entry..."
              value={submissionDesc}
              onChange={e => setSubmissionDesc(e.target.value)}
              rows={5}
            />
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Attachments (optional)</label>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf,.zip"
                onChange={e => setSubmissionFiles(Array.from(e.target.files || []).slice(0, 5))}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitEntry} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Winners Dialog */}
      <Dialog open={showWinnerDialog} onOpenChange={setShowWinnerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Winners</DialogTitle>
            <DialogDescription>Choose winners from the entries.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {[1, 2, 3].map(pos => {
              if (pos === 2 && !contest.prize_second) return null;
              if (pos === 3 && !contest.prize_third) return null;
              return (
                <div key={pos}>
                  <label className="text-sm font-medium mb-1 block">
                    {pos === 1 ? "🥇 1st Place" : pos === 2 ? "🥈 2nd Place" : "🥉 3rd Place"}
                  </label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={winnerSelections[pos] || ""}
                    onChange={e => setWinnerSelections(prev => ({ ...prev, [pos]: e.target.value }))}
                  >
                    <option value="">Select entry...</option>
                    {allEntries
                      .filter(e => !Object.values(winnerSelections).includes(e.id) || winnerSelections[pos] === e.id)
                      .map(e => (
                        <option key={e.id} value={e.id}>{(e.freelancer as any)?.full_name || "Expert"}</option>
                      ))}
                  </select>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWinnerDialog(false)}>Cancel</Button>
            <Button onClick={handleSelectWinners} disabled={selectingWinners}>
              {selectingWinners ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Award className="h-4 w-4 mr-2" />}
              Confirm Winners
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
