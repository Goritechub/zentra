import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getOpenJobs, getSavedJobIds, saveJob, unsaveJob } from "@/api/jobs.api";
import { formatNaira, cadSoftwareList, cadSkills, getAllStates } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Search, MapPin, Clock, Briefcase, X, ArrowRight,
  Bookmark, BookmarkCheck, Shield, CreditCard, ChevronDown, ChevronUp, Building2, Wrench,
} from "lucide-react";
import { JobCardSkeleton } from "@/components/skeletons/JobCardSkeleton";

const allSkillsAndTools = [...cadSoftwareList, ...cadSkills];

function computeMatch(jobSkills: string[], userSkills: string[]): number | null {
  if (!jobSkills?.length || !userSkills?.length) return null;
  const required = jobSkills.map((s) => s.toLowerCase());
  const mine = userSkills.map((s) => s.toLowerCase());
  const matched = required.filter((s) => mine.includes(s)).length;
  return Math.round((matched / required.length) * 100);
}

export default function JobsPage() {
  const { user, authError } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [jobType, setJobType] = useState("");
  const [jobLength, setJobLength] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState("");
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);

  const states = getAllStates();
  const filteredSkillSuggestions = allSkillsAndTools
    .filter((s) => s.toLowerCase().includes(skillSearch.toLowerCase()) && !selectedSkills.includes(s))
    .slice(0, 8);

  // Jobs list
  const jobsQuery = useQuery({
    queryKey: ["jobs-page", user?.id],
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: getOpenJobs,
  });
  const jobs: any[] = jobsQuery.data || [];

  // Saved job IDs (persisted if logged in, local otherwise)
  const [localSaved, setLocalSaved] = useState<Set<string>>(new Set());
  const savedIdsQuery = useQuery({
    queryKey: ["saved-job-ids", user?.id],
    queryFn: getSavedJobIds,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const savedJobIds: Set<string> = user
    ? new Set(savedIdsQuery.data || [])
    : localSaved;

  // User skills for match % (from freelancer profile via auth context or separate query)
  const [userSkills, setUserSkills] = useState<string[]>([]);
  useEffect(() => {
    if (!user) return;
    // Attempt to read skills from the user's profile — stored in freelancer_profiles.
    // We use the supabase client directly since there's no dedicated endpoint yet.
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase
        .from("freelancer_profiles")
        .select("skills")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.skills) setUserSkills(data.skills);
        });
    });
  }, [user?.id]);

  // Save / unsave mutations
  const saveMutation = useMutation({
    mutationFn: (jobId: string) => (user ? saveJob(jobId) : Promise.resolve()),
    onMutate: (jobId) => {
      if (!user) {
        setLocalSaved((prev) => { const n = new Set(prev); n.add(jobId); return n; });
        toast.success("Job saved!");
        return;
      }
      queryClient.setQueryData<string[]>(["saved-job-ids", user.id], (old) => [...(old || []), jobId]);
      toast.success("Job saved!");
    },
    onError: (_, jobId) => {
      queryClient.setQueryData<string[]>(["saved-job-ids", user?.id], (old) => (old || []).filter((id) => id !== jobId));
      toast.error("Failed to save job");
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: (jobId: string) => (user ? unsaveJob(jobId) : Promise.resolve()),
    onMutate: (jobId) => {
      if (!user) {
        setLocalSaved((prev) => { const n = new Set(prev); n.delete(jobId); return n; });
        toast.success("Job removed from saved");
        return;
      }
      queryClient.setQueryData<string[]>(["saved-job-ids", user.id], (old) => (old || []).filter((id) => id !== jobId));
      toast.success("Job removed from saved");
    },
    onError: (_, jobId) => {
      queryClient.setQueryData<string[]>(["saved-job-ids", user?.id], (old) => [...(old || []), jobId]);
      toast.error("Failed to remove saved job");
    },
  });

  const toggleSave = (jobId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (savedJobIds.has(jobId)) {
      unsaveMutation.mutate(jobId);
    } else {
      saveMutation.mutate(jobId);
    }
  };

  // Filters
  const applyFilters = (jobList: any[]) =>
    jobList
      .filter((job) => {
        const matchSearch =
          !searchTerm ||
          job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (job.required_skills || []).some((s: string) =>
            s.toLowerCase().includes(searchTerm.toLowerCase()),
          );
        const matchState = !selectedState || job.state === selectedState;
        const matchRemote = !remoteOnly || job.is_remote;
        const matchType =
          !jobType ||
          (jobType === "hourly" && job.is_hourly) ||
          (jobType === "fixed" && !job.is_hourly);
        const matchLength =
          !jobLength ||
          (() => {
            const days = job.delivery_days || 0;
            switch (jobLength) {
              case "short": return days <= 7;
              case "medium": return days > 7 && days <= 30;
              case "long": return days > 30 && days <= 90;
              case "extended": return days > 90;
              default: return true;
            }
          })();
        const matchSkills =
          selectedSkills.length === 0 ||
          selectedSkills.some((skill) =>
            [...(job.required_skills || []), ...(job.required_software || [])].some(
              (js: string) => js.toLowerCase() === skill.toLowerCase(),
            ),
          );
        return matchSearch && matchState && matchRemote && matchType && matchLength && matchSkills;
      })
      .sort((a, b) => {
        if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === "budget_high") return (b.budget_max || 0) - (a.budget_max || 0);
        if (sortBy === "budget_low") return (a.budget_min || 0) - (b.budget_max || 0);
        return 0;
      });

  const allFiltered = applyFilters(jobs);
  const savedFiltered = applyFilters(jobs.filter((j) => savedJobIds.has(j.id)));

  const clearFilters = () => {
    setSearchTerm(""); setSelectedState(""); setRemoteOnly(false);
    setJobType(""); setJobLength(""); setSortBy("newest"); setSelectedSkills([]);
  };
  const hasFilters = searchTerm || selectedState || remoteOnly || jobType || jobLength || sortBy !== "newest" || selectedSkills.length > 0;

  // Job card
  const JobCard = ({ job, showRemove = false }: { job: any; showRemove?: boolean }) => {
    const match = computeMatch(
      [...(job.required_skills || []), ...(job.required_software || [])],
      userSkills,
    );
    const isSaved = savedJobIds.has(job.id);

    return (
      <div className="bg-card rounded-xl border border-border p-6 hover:shadow-sm transition-shadow">
        <div className="flex items-start justify-between gap-4">
          {/* Left: main content */}
          <Link to={`/job/${job.id}`} className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg text-foreground hover:text-primary transition-colors">
                {job.title}
              </h3>
              {match !== null && (
                <Badge variant="outline" className="text-xs font-medium border-primary/40 text-primary">
                  {match}% match
                </Badge>
              )}
              {job.is_nda && (
                <Badge variant="outline" className="text-xs gap-1 border-amber-400/60 text-amber-700 dark:text-amber-400">
                  <Shield className="h-3 w-3" /> NDA
                </Badge>
              )}
              {job.payment_ready && (
                <Badge variant="outline" className="text-xs gap-1 border-green-500/60 text-green-700 dark:text-green-400">
                  <CreditCard className="h-3 w-3" /> Payment ready
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{job.description}</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(job.required_skills || []).slice(0, 5).map((s: string) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
              {(job.required_skills || []).length > 5 && (
                <Badge variant="secondary" className="text-xs">+{(job.required_skills || []).length - 5}</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
              </span>
              {job.delivery_days && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {(() => {
                    const u = job.delivery_unit || "days";
                    const d = job.delivery_days;
                    if (u === "weeks") return `${Math.round(d / 7)}w`;
                    if (u === "months") return `${Math.round(d / 30)}mo`;
                    return `${d}d`;
                  })()}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.is_remote ? "Remote" : `${job.city || job.state || "Nigeria"}`}
              </span>
              <Badge variant="outline" className="text-xs py-0">{job.is_hourly ? "Hourly" : "Fixed"}</Badge>
            </div>
          </Link>

          {/* Right: budget + actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {showRemove ? (
              <button
                onClick={(e) => toggleSave(job.id, e)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-full hover:bg-destructive/10"
                title="Remove from saved"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={(e) => toggleSave(job.id, e)}
                className="text-muted-foreground hover:text-primary transition-colors p-1"
                title={isSaved ? "Remove from saved" : "Save job"}
              >
                {isSaved
                  ? <BookmarkCheck className="h-4.5 w-4.5 text-primary fill-current" />
                  : <Bookmark className="h-4.5 w-4.5" />
                }
              </button>
            )}
            <p className="text-lg font-bold text-primary text-right">
              {job.budget_min && job.budget_max
                ? `${formatNaira(job.budget_min)} – ${formatNaira(job.budget_max)}`
                : job.budget_min
                  ? formatNaira(job.budget_min)
                  : "Negotiable"}
            </p>
            <Button variant="default" size="sm" asChild>
              <Link to={`/job/${job.id}`}>
                View Details <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="container-wide py-8">
          {authError && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {authError}
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Job Listings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {jobsQuery.isFetching ? "Refreshing…" : `${jobs.length} open jobs`}
            </p>
          </div>

          {/* ─── Primary filter bar ─── */}
          <div className="bg-card rounded-xl border border-border p-4 mb-4 shadow-card">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, skill, or keyword…"
                  className="pl-9 h-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={jobType} onValueChange={(v) => setJobType(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[130px] h-10"><SelectValue placeholder="Job Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="fixed">Fixed Price</SelectItem>
                </SelectContent>
              </Select>
              <Select value={jobLength} onValueChange={(v) => setJobLength(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[140px] h-10"><SelectValue placeholder="Duration" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Length</SelectItem>
                  <SelectItem value="short">≤ 1 week</SelectItem>
                  <SelectItem value="medium">1 week – 1 month</SelectItem>
                  <SelectItem value="long">1 – 3 months</SelectItem>
                  <SelectItem value="extended">3+ months</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px] h-10"><SelectValue placeholder="Date Posted" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="budget_high">Budget: High</SelectItem>
                  <SelectItem value="budget_low">Budget: Low</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 gap-1 text-muted-foreground"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                Filters {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 text-muted-foreground">
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              )}
            </div>

            {/* ─── Advanced filters (collapsible) ─── */}
            {showAdvanced && (
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-3 items-start">
                <Select value={selectedState} onValueChange={(v) => setSelectedState(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[160px] h-10">
                    <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  variant={remoteOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRemoteOnly(!remoteOnly)}
                  className="h-10"
                >
                  <Building2 className="h-4 w-4 mr-1" /> Remote Only
                </Button>

                {/* Skills filter */}
                <div className="relative">
                  <div className="flex items-center gap-1 mb-1">
                    <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Skills/Tools</span>
                  </div>
                  <Input
                    value={skillSearch}
                    onChange={(e) => { setSkillSearch(e.target.value); setShowSkillDropdown(true); }}
                    onFocus={() => setShowSkillDropdown(true)}
                    onBlur={() => setTimeout(() => setShowSkillDropdown(false), 200)}
                    placeholder="Search AutoCAD, Revit…"
                    className="h-10 w-[200px]"
                  />
                  {showSkillDropdown && skillSearch && filteredSkillSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredSkillSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onMouseDown={() => {
                            if (!selectedSkills.includes(s)) setSelectedSkills([...selectedSkills, s]);
                            setSkillSearch("");
                            setShowSkillDropdown(false);
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {selectedSkills.map((skill) => (
                      <Badge key={skill} variant="default" className="gap-1 pr-1 text-xs">
                        {skill}
                        <button type="button" onClick={() => setSelectedSkills(selectedSkills.filter((s) => s !== skill))} className="ml-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Tabs ─── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Jobs ({allFiltered.length})</TabsTrigger>
              <TabsTrigger value="saved">Saved ({savedFiltered.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {jobsQuery.isPending && !jobsQuery.data ? (
                <div className="space-y-3">
                  <JobCardSkeleton count={5} />
                </div>
              ) : allFiltered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Briefcase className="h-8 w-8 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No jobs match your filters</p>
                  {hasFilters && <Button variant="ghost" className="mt-3" onClick={clearFilters}>Clear filters</Button>}
                </div>
              ) : (
                <div className="space-y-3">
                  {allFiltered.map((job) => <JobCard key={job.id} job={job} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="saved">
              {savedFiltered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Bookmark className="h-10 w-10 mx-auto mb-4 opacity-40" />
                  <p className="font-medium">No saved jobs yet</p>
                  <p className="text-sm mt-1">Click the bookmark icon on any job to save it here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedFiltered.map((job) => <JobCard key={job.id} job={job} showRemove />)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
