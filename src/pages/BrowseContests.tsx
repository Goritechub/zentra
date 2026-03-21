import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getBrowseContestsList } from "@/api/client-read.api";
import { formatNaira } from "@/lib/nigerian-data";
import { isPast, formatDistanceToNow } from "date-fns";
import { Loader2, Trophy, Calendar, Users, ArrowLeft } from "lucide-react";

// Canonical status derivation — mirrors ContestDetail.tsx
function deriveContestStatus(contest: any, winnersCount: number): "active" | "selecting_winners" | "completed" {
  if (winnersCount > 0 || contest.status === "ended" || contest.status === "completed") return "completed";
  if (contest.status === "selecting_winners" || isPast(new Date(contest.deadline))) return "selecting_winners";
  return "active";
}

function statusLabel(s: ReturnType<typeof deriveContestStatus>) {
  if (s === "completed") return "Completed";
  if (s === "selecting_winners") return "Selecting Winners";
  return "Active";
}

function statusVariant(s: ReturnType<typeof deriveContestStatus>): "default" | "secondary" | "outline" {
  if (s === "completed") return "secondary";
  if (s === "selecting_winners") return "outline";
  return "default";
}

export default function BrowseContestsPage() {
  const { user, bootstrapStatus, authError } = useAuth();
  const navigate = useNavigate();
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (bootstrapStatus === "ready" && user) {
      void fetchContests();
    }
  }, [bootstrapStatus, user]);

  const fetchContests = async () => {
    setLoading(true);
    try {
      const response = await getBrowseContestsList();
      setContests(response.data.contests || []);
    } catch {
      setContests([]);
    } finally {
      setLoading(false);
    }
  };

  // All five prize tiers
  const totalPrize = (c: any) =>
    (c.prize_first || 0) + (c.prize_second || 0) + (c.prize_third || 0) + (c.prize_fourth || 0) + (c.prize_fifth || 0);

  if (!user || bootstrapStatus !== "ready") {
    return null;
  }

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
          <h1 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" /> Browse Contests
          </h1>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="bg-card rounded-xl border border-border p-6">
                  <div className="h-5 w-1/2 rounded bg-muted animate-pulse mb-2" />
                  <div className="h-4 w-2/3 rounded bg-muted/70 animate-pulse mb-3" />
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              ))}
            </div>
          ) : contests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contests available yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {contests.map((contest: any) => {
                const derived = deriveContestStatus(contest, contest._winnersCount || 0);
                const dimmed = derived === "completed";

                return (
                  <Link
                    key={contest.id}
                    to={`/contest/${contest.id}`}
                    className={`bg-card rounded-xl border border-border overflow-hidden card-hover transition-all ${
                      dimmed ? "opacity-60 grayscale-[30%]" : ""
                    }`}
                  >
                    {/* Banner */}
                    <div className="h-40 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative overflow-hidden">
                      {contest.banner_image ? (
                        <img src={contest.banner_image} alt={contest.title} className="w-full h-full object-cover" />
                      ) : (
                        <Trophy className="h-16 w-16 text-primary/30" />
                      )}
                      <Badge variant={statusVariant(derived)} className="absolute top-3 right-3">
                        {statusLabel(derived)}
                      </Badge>
                    </div>

                    <div className="p-5">
                      <h3 className="font-semibold text-lg text-foreground line-clamp-1">{contest.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{contest.description}</p>

                      <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
                        <span className="font-bold text-primary text-base">{formatNaira(totalPrize(contest))}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {contest._entryCount || 0} entries
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {derived === "completed"
                            ? "Completed"
                            : derived === "selecting_winners"
                              ? "Selecting Winners"
                              : `${formatDistanceToNow(new Date(contest.deadline))} left`}
                        </span>
                      </div>
                      {contest.category && (
                        <Badge variant="outline" className="mt-3 text-xs">
                          {contest.category}
                        </Badge>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
