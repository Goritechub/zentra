import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { Briefcase, PlusCircle, Loader2, ArrowRight, ArrowLeft } from "lucide-react";

export default function ClientJobsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchJobs();
  }, [user, authLoading]);

  const fetchJobs = async () => {
    const { data } = await supabase.from("jobs").select("*").eq("client_id", user!.id).order("created_at", { ascending: false });
    setJobs(data || []);
    setLoading(false);
  };

  const filterByStatus = (status: string) => {
    if (status === "all") return jobs;
    return jobs.filter(j => j.status === status);
  };

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
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-foreground">My Jobs</h1>
            <Button asChild><Link to="/post-job"><PlusCircle className="h-4 w-4 mr-2" />Post New Job</Link></Button>
          </div>

          <Tabs defaultValue="all">
            <TabsList className="mb-6">
              <TabsTrigger value="all">All ({jobs.length})</TabsTrigger>
              <TabsTrigger value="open">Open ({filterByStatus("open").length})</TabsTrigger>
              <TabsTrigger value="in_progress">Ongoing ({filterByStatus("in_progress").length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({filterByStatus("completed").length})</TabsTrigger>
              <TabsTrigger value="cancelled">Closed ({filterByStatus("cancelled").length})</TabsTrigger>
            </TabsList>

            {["all", "open", "in_progress", "completed", "cancelled"].map(status => (
              <TabsContent key={status} value={status}>
                {filterByStatus(status).length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No {status === "all" ? "" : status} jobs found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filterByStatus(status).map(job => (
                      <Link key={job.id} to={`/job/${job.id}`} className="block bg-card rounded-xl border border-border p-6 card-hover">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={job.status === "open" ? "default" : "secondary"}>{job.status}</Badge>
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">{job.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{job.description}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="text-right">
                            {(job.budget_min || job.budget_max) && (
                              <p className="font-bold text-primary">{formatNaira(job.budget_max || job.budget_min || 0)}</p>
                            )}
                            <ArrowRight className="h-4 w-4 text-muted-foreground mt-2 ml-auto" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
