import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
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
import {
  getBrowseExpertsList,
  removeSavedExpertByFreelancer,
  saveExpert,
} from "@/api/client-read.api";
import { useAuth } from "@/hooks/useAuth";
import { formatNaira, getAllStates, cadSoftwareList } from "@/lib/nigerian-data";
import { categoryNames, getCategoryBySlug } from "@/lib/categories";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Search, MapPin, Star, CheckCircle2, SlidersHorizontal, X, MessageSquare, Heart, Loader2, Trash2
} from "lucide-react";

export default function FreelancersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const slug = searchParams.get("category");
    if (slug) {
      const cat = getCategoryBySlug(slug);
      return cat?.name || "";
    }
    return "";
  });
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const states = getAllStates();

  const freelancersQuery = useQuery({
    queryKey: ["freelancers-page", user?.id],
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const data = await getBrowseExpertsList();
      return {
        freelancers: data.freelancers || [],
        savedIds: new Set(data.savedIds || []),
        savedExperts: data.savedExperts || [],
      };
    },
  });

  const freelancers = freelancersQuery.data?.freelancers || [];
  const savedIds = freelancersQuery.data?.savedIds || new Set<string>();
  const savedExperts = freelancersQuery.data?.savedExperts || [];

  const filtered = freelancers.filter((f) => {
    const p = f.profile;
    if (!p) return false;
    const term = searchTerm.toLowerCase().replace(/^@/, "");
    const matchSearch = !searchTerm ||
      (p.full_name || "").toLowerCase().includes(term) ||
      (p.username || "").toLowerCase().includes(term) ||
      (f.title || "").toLowerCase().includes(term) ||
      (f.skills || []).some((s: string) => s.toLowerCase().includes(term));
    const matchState = !selectedState || p.state === selectedState;
    const matchSkill = !selectedSkill || (f.skills || []).includes(selectedSkill);
    const matchCategory = !selectedCategory || 
      (f.title || "").toLowerCase().includes(selectedCategory.toLowerCase()) ||
      (f.skills || []).some((s: string) => s.toLowerCase().includes(selectedCategory.toLowerCase())) ||
      (p.occupation || "").toLowerCase().includes(selectedCategory.toLowerCase());
    const matchVerified = !verifiedOnly || p.is_verified;
    return matchSearch && matchState && matchSkill && matchCategory && matchVerified;
  });

  const clearFilters = () => { setSearchTerm(""); setSelectedState(""); setSelectedSkill(""); setSelectedCategory(""); setVerifiedOnly(false); };
  const hasFilters = searchTerm || selectedState || selectedSkill || selectedCategory || verifiedOnly;

  const handleSaveExpert = async (e: React.MouseEvent, freelancerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate("/auth"); return; }
    
    if (savedIds.has(freelancerId)) {
      await removeSavedExpertByFreelancer(freelancerId);
      queryClient.invalidateQueries({ queryKey: ["freelancers-page", user?.id] });
      toast.success("Expert removed from saved list");
    } else {
      try {
        await saveExpert(freelancerId);
        toast.success("Expert saved!");
        queryClient.invalidateQueries({ queryKey: ["freelancers-page", user?.id] });
      } catch (error) {
        toast.error("Failed to save expert");
      }
    }
  };

  const removeSaved = async (e: React.MouseEvent, _itemId: string, freelancerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    await removeSavedExpertByFreelancer(freelancerId);
    queryClient.invalidateQueries({ queryKey: ["freelancers-page", user?.id] });
    toast.success("Expert removed from saved list");
  };

  if (freelancersQuery.isPending && !freelancersQuery.data) {
    return <div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div><Footer /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="bg-hero-gradient text-white py-12">
          <div className="container-wide">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Find CAD Experts in Nigeria</h1>
            <p className="text-white/80 text-lg max-w-2xl">Browse verified CAD professionals across all Nigerian states.</p>
          </div>
        </div>

        <div className="container-wide py-8">
          {freelancersQuery.isFetching && (
            <p className="text-sm text-muted-foreground mb-4">Refreshing experts...</p>
          )}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">All Experts</TabsTrigger>
              <TabsTrigger value="saved">
                <Heart className="h-4 w-4 mr-1.5" /> Saved Experts
                {savedExperts.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5">{savedExperts.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {/* Search & Filters */}
              <div className="bg-card rounded-xl border border-border p-4 mb-8 shadow-card">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Search by name, @username, skill, or title..." className="pl-10 h-12" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[180px] h-12"><SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="All Categories" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Categories</SelectItem>{categoryNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={selectedState} onValueChange={(v) => setSelectedState(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[180px] h-12"><MapPin className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="All States" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All States</SelectItem>{states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={selectedSkill} onValueChange={(v) => setSelectedSkill(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[180px] h-12"><SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="All Skills" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Skills</SelectItem>{cadSoftwareList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant={verifiedOnly ? "default" : "outline"} onClick={() => setVerifiedOnly(!verifiedOnly)} className="h-12">
                      <CheckCircle2 className="h-4 w-4 mr-2" />Verified Only
                    </Button>
                    {hasFilters && <Button variant="ghost" onClick={clearFilters} className="h-12"><X className="h-4 w-4 mr-2" />Clear</Button>}
                  </div>
                </div>
              </div>

              <p className="text-muted-foreground mb-6">Showing <span className="font-semibold text-foreground">{filtered.length}</span> experts</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map((f) => {
                  const p = f.profile;
                  return (
                    <div key={f.id} className="group bg-card rounded-xl border border-border p-6 card-hover cursor-pointer" onClick={() => navigate(`/expert/${f.user_id}/profile`)}>
                      <div className="flex items-start justify-between mb-4">
                        <Avatar className="h-16 w-16 border-2 border-background shadow-lg">
                          <AvatarImage src={p?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                            {(p?.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-1">
                          {p?.is_verified && <div className="verified-badge"><CheckCircle2 className="h-3 w-3" />Verified</div>}
                        </div>
                      </div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        <Link to={`/expert/${f.user_id}/profile`} onClick={(e) => e.stopPropagation()} className="hover:underline">{p?.full_name}</Link>
                      </h3>
                      {p?.username && <p className="text-xs text-muted-foreground"><Link to={`/expert/${f.user_id}/profile`} onClick={(e) => e.stopPropagation()} className="hover:underline">@{p.username}</Link></p>}
                      <p className="text-sm text-muted-foreground mt-1">{f.title || "CAD Professional"}</p>
                      {p?.state && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                          <MapPin className="h-3.5 w-3.5" />{p.city ? `${p.city}, ` : ""}{p.state}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <Star className="h-4 w-4 fill-accent text-accent" />
                        <span className="font-semibold text-foreground">{f.rating || "0"}</span>
                        <span className="text-sm text-muted-foreground">({f.total_jobs_completed || 0} jobs)</span>
                      </div>
                      {f.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-4">
                          {f.skills.slice(0, 3).map((s: string) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                          {f.skills.length > 3 && <Badge variant="secondary" className="text-xs">+{f.skills.length - 3}</Badge>}
                        </div>
                      )}
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            {f.hourly_rate && (
                              <>
                                <p className="text-sm text-muted-foreground">Starting at</p>
                                <p className="text-lg font-bold text-primary">{formatNaira(f.hourly_rate)}<span className="text-sm font-normal text-muted-foreground">/hr</span></p>
                              </>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={(e) => handleSaveExpert(e, f.user_id)}>
                              <Heart className={`h-4 w-4 ${savedIds.has(f.user_id) ? "fill-current text-destructive" : ""}`} />
                            </Button>
                            <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(user ? `/messages?user=${f.user_id}` : "/auth"); }}>
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-16">
                  <Search className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No freelancers found</h3>
                  <Button onClick={clearFilters}>Clear Filters</Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="saved">
              {savedExperts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No saved experts yet</p>
                  <Button className="mt-4" onClick={() => setActiveTab("all")}>Browse Experts</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedExperts.map((item: any) => {
                    const f = item.freelancer;
                    const fp = item.freelancerProfile;
                    if (!f) return null;
                    return (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/expert/${item.freelancer_id}/profile`)}
                        className="block bg-card rounded-xl border border-border p-6 card-hover transition-all hover:border-primary/30 cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <Avatar className="h-14 w-14">
                            <AvatarImage src={f.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {(f.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={(e) => removeSaved(e, item.id, item.freelancer_id)}>
                            <Heart className="h-4 w-4 fill-current" />
                          </Button>
                        </div>
                        <h3 className="font-semibold text-foreground">{f.full_name}</h3>
                        {fp?.title && (
                          <p className="text-sm text-primary font-medium mt-0.5">{fp.title}</p>
                        )}
                        {f.state && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />{f.city ? `${f.city}, ` : ""}{f.state}
                          </p>
                        )}
                        {fp && (
                          <div className="flex items-center gap-2 mt-2">
                            <Star className="h-4 w-4 fill-accent text-accent" />
                            <span className="font-semibold text-sm text-foreground">{fp.rating || "0"}</span>
                            <span className="text-xs text-muted-foreground">({fp.total_jobs_completed || 0} jobs)</span>
                          </div>
                        )}
                        {fp?.skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {fp.skills.slice(0, 3).map((s: string) => (
                              <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                            {fp.skills.length > 3 && <Badge variant="secondary" className="text-xs">+{fp.skills.length - 3}</Badge>}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-3">
                          Saved {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    );
                  })}
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
