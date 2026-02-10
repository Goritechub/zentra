import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getAllStates, formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import {
  Search, MapPin, Clock, Briefcase, Calendar, X, Building2, ArrowRight, MessageSquare, Loader2
} from "lucide-react";

export default function JobsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);

  const states = getAllStates();

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("*, client:profiles!jobs_client_id_fkey(full_name, avatar_url)")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    setJobs(data || []);
    setLoading(false);
  };

  const filtered = jobs.filter((job) => {
    const matchSearch = !searchTerm ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.required_skills || []).some((s: string) => s.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchState = !selectedState || job.state === selectedState;
    const matchRemote = !remoteOnly || job.is_remote;
    return matchSearch && matchState && matchRemote;
  });

  const clearFilters = () => { setSearchTerm(""); setSelectedState(""); setRemoteOnly(false); };
  const hasFilters = searchTerm || selectedState || remoteOnly;

  if (loading) {
    return <div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div><Footer /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="bg-hero-gradient text-white py-12">
          <div className="container-wide">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Browse CAD Jobs in Nigeria</h1>
            <p className="text-white/80 text-lg max-w-2xl">Find CAD projects that match your skills.</p>
          </div>
        </div>

        <div className="container-wide py-8">
          <div className="bg-card rounded-xl border border-border p-4 mb-8 shadow-card">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input placeholder="Search jobs by title, skill, or keyword..." className="pl-10 h-12" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Select value={selectedState} onValueChange={(v) => setSelectedState(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[180px] h-12"><MapPin className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="All States" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All States</SelectItem>{states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant={remoteOnly ? "default" : "outline"} onClick={() => setRemoteOnly(!remoteOnly)} className="h-12">
                  <Building2 className="h-4 w-4 mr-2" />Remote Only
                </Button>
                {hasFilters && <Button variant="ghost" onClick={clearFilters} className="h-12"><X className="h-4 w-4 mr-2" />Clear</Button>}
              </div>
            </div>
          </div>

          <p className="text-muted-foreground mb-6">Showing <span className="font-semibold text-foreground">{filtered.length}</span> jobs</p>

          <div className="space-y-4">
            {filtered.map((job) => (
              <Link key={job.id} to={`/job/${job.id}`} className="block bg-card rounded-xl border border-border p-6 card-hover">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-4 mb-3">
                      <Avatar className="h-12 w-12 hidden sm:flex">
                        <AvatarImage src={job.client?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {(job.client?.full_name || "C").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-lg text-foreground hover:text-primary transition-colors">{job.title}</h3>
                        <p className="text-sm text-muted-foreground">{job.client?.full_name || "Client"}</p>
                      </div>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 mb-4">{job.description}</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(job.required_skills || []).map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.is_remote ? "Remote" : `${job.city || ""} ${job.state || ""}`}</span>
                      {job.delivery_days && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{job.delivery_days} days</span>}
                      <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="md:text-right">
                    <p className="text-sm text-muted-foreground mb-1">Budget</p>
                    <p className="text-xl font-bold text-primary">
                      {job.budget_min && job.budget_max ? `${formatNaira(job.budget_min)} - ${formatNaira(job.budget_max)}` : job.budget_min ? formatNaira(job.budget_min) : "Negotiable"}
                    </p>
                    <Button variant="default" size="sm" className="mt-3">
                      View Details <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <Briefcase className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
              <Button onClick={clearFilters}>Clear Filters</Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
