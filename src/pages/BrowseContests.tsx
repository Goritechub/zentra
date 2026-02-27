import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { isPast, formatDistanceToNow } from "date-fns";
import { Loader2, Trophy, Calendar, Users, ArrowLeft } from "lucide-react";

export default function BrowseContestsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchContests();
  }, [user, authLoading]);

  const fetchContests = async () => {
    const { data } = await supabase
      .from("contests" as any)
      .select("*, client:profiles!contests_client_id_fkey(full_name)")
      .order("created_at", { ascending: false });

    const contestList = (data as any[]) || [];

    // Fetch entry counts
    if (contestList.length > 0) {
      const ids = contestList.map(c => c.id);
      const { data: entries } = await supabase
        .from("contest_entries")
        .select("contest_id")
        .in("contest_id", ids);

      const countMap = new Map<string, number>();
      (entries || []).forEach((e: any) => {
        countMap.set(e.contest_id, (countMap.get(e.contest_id) || 0) + 1);
      });

      contestList.forEach(c => { c._entryCount = countMap.get(c.id) || 0; });
    }

    setContests(contestList);
    setLoading(false);
  };

  const totalPrize = (c: any) => (c.prize_first || 0) + (c.prize_second || 0) + (c.prize_third || 0);

  if (authLoading || loading) {
    return <div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div><Footer /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" /> Browse Contests
          </h1>

          {contests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contests available yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {contests.map((contest: any) => {
                const ended = isPast(new Date(contest.deadline)) || contest.status === "ended";
                return (
                  <Link
                    key={contest.id}
                    to={`/contest/${contest.id}`}
                    className={`bg-card rounded-xl border border-border overflow-hidden card-hover transition-all ${ended ? "opacity-60 grayscale-[30%]" : ""}`}
                  >
                    {/* Banner */}
                    <div className="h-40 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative overflow-hidden">
                      {contest.banner_image ? (
                        <img src={contest.banner_image} alt={contest.title} className="w-full h-full object-cover" />
                      ) : (
                        <Trophy className="h-16 w-16 text-primary/30" />
                      )}
                      <Badge
                        variant={ended ? "secondary" : "default"}
                        className="absolute top-3 right-3"
                      >
                        {ended ? "Ended" : "Active"}
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
                          {ended ? "Ended" : `${formatDistanceToNow(new Date(contest.deadline))} left`}
                        </span>
                      </div>
                      {contest.category && (
                        <Badge variant="outline" className="mt-3 text-xs">{contest.category}</Badge>
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
