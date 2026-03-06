import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { format, isPast } from "date-fns";
import { Loader2, ArrowLeft, Trophy, Bookmark, FileText, Calendar, Award } from "lucide-react";

// Canonical status derivation — mirrors ContestDetail.tsx
function deriveContestStatus(contest: any, isWinner: boolean): "active" | "selecting_winners" | "completed" {
  // An entry with is_winner=true means winners are published → completed
  if (isWinner || contest.status === "ended" || contest.status === "completed") return "completed";
  if (contest.status === "selecting_winners" || isPast(new Date(contest.deadline))) return "selecting_winners";
  return "active";
}

export default function ContestEntriesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchEntries();
  }, [user, authLoading]);

  const fetchEntries = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("contest_entries")
      .select(
        "*, contest:contests(id, title, description, deadline, status, prize_first, prize_second, prize_third, prize_fourth, prize_fifth, client_id, client:profiles!contests_client_id_fkey(full_name))",
      )
      .eq("freelancer_id", user.id)
      .order("created_at", { ascending: false });
    setEntries((data as any[]) || []);
    setLoading(false);
  };

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

  const entered = entries.filter((e) => !e.is_winner);
  const won = entries.filter((e) => e.is_winner);

  // All five prize tiers
  const totalPrize = (c: any) =>
    (c.prize_first || 0) + (c.prize_second || 0) + (c.prize_third || 0) + (c.prize_fourth || 0) + (c.prize_fifth || 0);

  const EmptyState = ({ icon: Icon, text, sub }: { icon: any; text: string; sub?: string }) => (
    <div className="text-center py-16 text-muted-foreground">
      <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p className="font-medium">{text}</p>
      {sub && <p className="text-sm mt-1">{sub}</p>}
    </div>
  );

  const EntryCard = ({ entry }: { entry: any }) => {
    const contest = entry.contest;
    if (!contest) return null;

    const derived = deriveContestStatus(contest, entry.is_winner);

    const statusBadgeVariant =
      derived === "completed"
        ? ("secondary" as const)
        : derived === "selecting_winners"
          ? ("outline" as const)
          : ("default" as const);

    const statusText =
      derived === "completed" ? "Completed" : derived === "selecting_winners" ? "Selecting Winners" : "Active";

    const prizePositionLabel =
      entry.prize_position === 1
        ? "1st Place"
        : entry.prize_position === 2
          ? "2nd Place"
          : entry.prize_position === 3
            ? "3rd Place"
            : entry.prize_position
              ? `${entry.prize_position}th Place`
              : "";

    return (
      <div className="bg-card rounded-xl border border-border p-6 card-hover">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-foreground">{contest.title}</h3>
              {entry.is_winner && (
                <Badge variant="default" className="gap-1 bg-accent text-accent-foreground">
                  <Award className="h-3 w-3" />
                  {prizePositionLabel}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">By {contest.client?.full_name || "Client"}</p>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Submitted {format(new Date(entry.created_at), "MMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {derived === "active" ? `Ends ${format(new Date(contest.deadline), "MMM d, yyyy")}` : statusText}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-primary">{formatNaira(totalPrize(contest))}</p>
            <p className="text-xs text-muted-foreground">Total Prizes</p>
            <Badge variant={statusBadgeVariant} className="mt-2">
              {statusText}
            </Badge>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-accent" /> Contest Entries
          </h1>

          <Tabs defaultValue="entered" className="space-y-6">
            <TabsList>
              <TabsTrigger value="entered">Entered ({entered.length})</TabsTrigger>
              <TabsTrigger value="won">Won ({won.length})</TabsTrigger>
              <TabsTrigger value="saved">Saved</TabsTrigger>
            </TabsList>

            <TabsContent value="entered">
              {entered.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  text="No contest entries yet"
                  sub="Browse contests and submit your work to compete."
                />
              ) : (
                <div className="space-y-4">
                  {entered.map((e) => (
                    <EntryCard key={e.id} entry={e} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="won">
              {won.length === 0 ? (
                <EmptyState icon={Trophy} text="No wins yet" sub="Keep entering contests — your time will come!" />
              ) : (
                <div className="space-y-4">
                  {won.map((e) => (
                    <EntryCard key={e.id} entry={e} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="saved">
              <EmptyState
                icon={Bookmark}
                text="No saved contests"
                sub="Save contests you're interested in to find them here later."
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
