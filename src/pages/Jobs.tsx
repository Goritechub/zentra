import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getOpenJobs } from "@/api/jobs.api";
import { getAllStates, formatNaira, cadSoftwareList, cadSkills } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Search, MapPin, Clock, Briefcase, Calendar, X, Building2, ArrowRight, Loader2, Bookmark, BookmarkCheck, Wrench
} from "lucide-react";
import { FundingStatusBadge } from "@/components/FundingStatusBadge";

const allSkillsAndTools = [...cadSoftwareList, ...cadSkills];

export default function JobsPage() {
  const navigate = useNavigate();
  const { user, authError } = useAuth();
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [jobType, setJobType] = useState("");
  const [jobLength, setJobLength] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState("");
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const states = getAllStates();

  const filteredSkillSuggestions = allSkillsAndTools
    .filter(s => s.toLowerCase().includes(skillSearch.toLowerCase()) && !selectedSkills.includes(s))
    .slice(0, 8);

  const jobsQuery = useQuery({
    queryKey: ["jobs-page", user?.id],
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    queryFn: getOpenJobs,
  });

  const jobs = jobsQuery.data || [];

  const toggleSaveJob = (jobId: string) => {
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
        toast.success("Job removed from saved");
      } else {
        next.add(jobId);
        toast.success("Job saved!");
      }
      return next;
    });
  };

  const addSkillFilter = (skill: string) => {
    if (!selectedSkills.includes(skill)) {
      setSelectedSkills([...selectedSkills, skill]);
    }
    setSkillSearch("");
    setShowSkillDropdown(false);
  };

  const removeSkillFilter = (skill: string) => {
    setSelectedSkills(selectedSkills.filter(s => s !== skill));
  };

  const applyFilters = (jobList: any[]) => {
    return jobList.filter((job) => {
      const matchSearch = !searchTerm ||
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.required_skills || []).some((s: string) => s.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchState = !selectedState || job.state === selectedState;
      const matchRemote = !remoteOnly || job.is_remote;
      const matchType = !jobType ||
        (jobType === "hourly" && job.is_hourly) ||
        (jobType === "fixed" && !job.is_hourly);
      const matchLength = !jobLength || (() => {
        const days = job.delivery_days || 0;
        switch (jobLength) {
          case "short": return days <= 7;
          case "medium": return days > 7 && days <= 30;
          case "long": return days > 30 && days <= 90;
          case "extended": return days > 90;
          default: return true;
        }
      })();
      const matchSkills = selectedSkills.length === 0 || selectedSkills.some(skill => {
        const jobSkills = [...(job.required_skills || []), ...(job.required_software || [])];
        return jobSkills.some((js: string) => js.toLowerCase() === skill.toLowerCase());
      });
      return matchSearch && matchState && matchRemote && matchType && matchLength && matchSkills;
    }).sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === "budget_high") return (b.budget_max || 0) - (a.budget_max || 0);
      if (sortBy === "budget_low") return (a.budget_min || 0) - (b.budget_min || 0);
      return 0;
    });
  };

  const allFiltered = applyFilters(jobs);
  const savedFiltered = applyFilters(jobs.filter((j) => savedJobIds.has(j.id)));

  const clearFilters = () => { setSearchTerm(""); setSelectedState(""); setRemoteOnly(false); setJobType(""); setJobLength(""); setSortBy("newest"); setSelectedSkills([]); };
  const hasFilters = searchTerm || selectedState || remoteOnly || jobType || jobLength || sortBy !== "newest" || selectedSkills.length > 0;

  const renderJobList = (filtered: any[]) => (
    <>
      <p className="text-muted-foreground mb-6">Showing <span className="font-semibold text-foreground">{filtered.length}</span> jobs</p>
      <div className="space-y-4">
        {filtered.map((job) => (
          <div key={job.id} className="block bg-card rounded-xl border border-border p-6 card-hover">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <Link to={`/job/${job.id}`} className="flex-1">
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
                  {job.delivery_days && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{(() => { const u = job.delivery_unit || "days"; const d = job.delivery_days; if (u === "weeks") return `${Math.round(d/7)} week${Math.round(d/7)!==1?"s":""}`; if (u === "months") return `${Math.round(d/30)} month${Math.round(d/30)!==1?"s":""}`; return `${d} day${d!==1?"s":""}`; })()}</span>}
                  {job.visibility === "private" && <Badge variant="outline" className="text-xs">🔒 Private</Badge>}
                  {job.invited_expert_ids?.length > 0 && job.visibility === "public" && <Badge variant="outline" className="text-xs">{job.invited_expert_ids.length} invited</Badge>}
                  <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                  <Badge variant="outline" className="text-xs">{job.is_hourly ? "Hourly" : "Fixed Price"}</Badge>
                  <FundingStatusBadge
                    clientId={job.client_id}
                    budgetMin={job.budget_min}
                    budgetMax={job.budget_max}
                  />
                </div>
              </Link>
              <div className="md:text-right flex md:flex-col items-center md:items-end gap-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Budget</p>
                  <p className="text-xl font-bold text-primary">
                    {job.budget_min && job.budget_max ? `${formatNaira(job.budget_min)} - ${formatNaira(job.budget_max)}` : job.budget_min ? formatNaira(job.budget_min) : "Negotiable"}
                  </p>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="ghost" onClick={() => toggleSaveJob(job.id)}>
                    {savedJobIds.has(job.id)
                      ? <BookmarkCheck className="h-4 w-4 text-primary fill-current" />
                      : <Bookmark className="h-4 w-4" />
                    }
                  </Button>
                  <Button variant="default" size="sm" asChild>
                    <Link to={`/job/${job.id}`}>View Details <ArrowRight className="h-4 w-4 ml-1" /></Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Briefcase className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
          <Button onClick={clearFilters}>Clear Filters</Button>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="bg-hero-gradient text-white py-12">
          <div className="container-wide">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Browse Engineering & Technical Jobs</h1>
            <p className="text-white/80 text-lg max-w-2xl">Find engineering, hardware, and STEM projects that match your skills.</p>
          </div>
        </div>

        <div className="container-wide py-8">
          {authError && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {authError}
            </div>
          )}
          {jobsQuery.isFetching && (
            <p className="text-sm text-muted-foreground mb-4">Refreshing jobs...</p>
          )}
          {/* Filters */}
          <div className="bg-card rounded-xl border border-border p-4 mb-6 shadow-card">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input placeholder="Search jobs by title, skill, or keyword..." className="pl-10 h-12" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Select value={selectedState} onValueChange={(v) => setSelectedState(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[160px] h-12"><MapPin className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="All States" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All States</SelectItem>{states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={jobType} onValueChange={(v) => setJobType(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[140px] h-12"><SelectValue placeholder="Job Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={jobLength} onValueChange={(v) => setJobLength(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[150px] h-12"><SelectValue placeholder="Job Length" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Length</SelectItem>
                    <SelectItem value="short">≤ 1 week</SelectItem>
                    <SelectItem value="medium">1 week – 1 month</SelectItem>
                    <SelectItem value="long">1 – 3 months</SelectItem>
                    <SelectItem value="extended">3+ months</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[150px] h-12"><SelectValue placeholder="Sort by" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="budget_high">Budget: High</SelectItem>
                    <SelectItem value="budget_low">Budget: Low</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant={remoteOnly ? "default" : "outline"} onClick={() => setRemoteOnly(!remoteOnly)} className="h-12">
                  <Building2 className="h-4 w-4 mr-2" />Remote Only
                </Button>
                {hasFilters && <Button variant="ghost" onClick={clearFilters} className="h-12"><X className="h-4 w-4 mr-2" />Clear</Button>}
              </div>
            </div>

            {/* Skills/Tools Filter */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Filter by Skills/Tools</span>
              </div>
              {selectedSkills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedSkills.map(skill => (
                    <Badge key={skill} variant="default" className="gap-1 pr-1">
                      {skill}
                      <button type="button" onClick={() => removeSkillFilter(skill)} className="ml-1 rounded-full hover:bg-primary-foreground/20 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="relative max-w-md">
                <Input
                  value={skillSearch}
                  onChange={(e) => { setSkillSearch(e.target.value); setShowSkillDropdown(true); }}
                  onFocus={() => setShowSkillDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSkillDropdown(false), 200)}
                  placeholder="Search AutoCAD, SolidWorks, Revit, BIM..."
                  className="h-10"
                />
                {showSkillDropdown && skillSearch && filteredSkillSuggestions.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredSkillSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onMouseDown={() => addSkillFilter(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs: All Jobs / Saved Jobs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList>
              <TabsTrigger value="all">All Jobs ({allFiltered.length})</TabsTrigger>
              <TabsTrigger value="saved">Saved Jobs ({savedFiltered.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              {jobsQuery.isPending && !jobsQuery.data ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin opacity-50" />
                  <p>Loading jobs...</p>
                </div>
              ) : renderJobList(allFiltered)}
            </TabsContent>
            <TabsContent value="saved">
              {jobsQuery.isPending && !jobsQuery.data ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin opacity-50" />
                  <p>Loading jobs...</p>
                </div>
              ) : savedJobIds.size === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No saved jobs yet</p>
                  <p className="text-sm mt-1">Click the bookmark icon on any job to save it</p>
                </div>
              ) : (
                renderJobList(savedFiltered)
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
