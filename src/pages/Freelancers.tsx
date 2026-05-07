import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getBrowseExpertsList,
  removeSavedExpertByFreelancer,
  saveExpert,
} from "@/api/client-read.api";
import { useAuth } from "@/hooks/useAuth";
import { cadSoftwareList } from "@/lib/nigerian-data";
import { useCurrency } from "@/hooks/useCurrency";
import { categoryNames, getCategoryBySlug } from "@/lib/categories";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Search, MapPin, Star, CheckCircle2, SlidersHorizontal, X, Heart,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { FreelancerCardSkeleton } from "@/components/skeletons/FreelancerCardSkeleton";

const PAGE_SIZE = 9;

const PRICE_RANGES = [
  { label: "Under ₦5,000/hr", min: 0, max: 4_999 },
  { label: "₦5,000 – ₦20,000/hr", min: 5_000, max: 20_000 },
  { label: "₦20,000 – ₦75,000/hr", min: 20_001, max: 75_000 },
  { label: "₦75,000+/hr", min: 75_001, max: Infinity },
];

const EXP_LEVELS = [
  { label: "Entry Level", min: 0, max: 2 },
  { label: "Intermediate", min: 3, max: 5 },
  { label: "Expert", min: 6, max: Infinity },
];

// ── Sidebar ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  selectedPrices: string[];
  togglePrice: (label: string) => void;
  selectedExp: string[];
  toggleExp: (label: string) => void;
  selectedSoftware: string[];
  toggleSoftware: (s: string) => void;
}

function FilterSidebar({
  selectedCategory, setSelectedCategory,
  selectedPrices, togglePrice,
  selectedExp, toggleExp,
  selectedSoftware, toggleSoftware,
}: SidebarProps) {
  return (
    <div className="space-y-5 text-sm">
      {/* Category */}
      <div>
        <p className="font-semibold text-foreground mb-2">Category</p>
        <div className="space-y-0.5">
          <button
            onClick={() => setSelectedCategory("")}
            className={`w-full text-left px-3 py-1.5 rounded-md transition-colors ${
              !selectedCategory
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            All
          </button>
          {categoryNames.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? "" : cat)}
              className={`w-full text-left px-3 py-1.5 rounded-md transition-colors ${
                selectedCategory === cat
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Price Range */}
      <div>
        <p className="font-semibold text-foreground mb-2">Price Range</p>
        <div className="space-y-2">
          {PRICE_RANGES.map((r) => (
            <label key={r.label} className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={selectedPrices.includes(r.label)}
                onCheckedChange={() => togglePrice(r.label)}
              />
              <span className="text-muted-foreground leading-none">{r.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Experience Level */}
      <div>
        <p className="font-semibold text-foreground mb-2">Experience Level</p>
        <div className="space-y-2">
          {EXP_LEVELS.map((e) => (
            <label key={e.label} className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={selectedExp.includes(e.label)}
                onCheckedChange={() => toggleExp(e.label)}
              />
              <span className="text-muted-foreground leading-none">{e.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Software Tools */}
      <div>
        <p className="font-semibold text-foreground mb-2">Software Tools</p>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {cadSoftwareList.map((s) => (
            <label key={s} className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={selectedSoftware.includes(s)}
                onCheckedChange={() => toggleSoftware(s)}
              />
              <span className="text-muted-foreground leading-none">{s}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function FreelancersPage() {
  const { format } = useCurrency();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);

  // Sidebar filters
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const slug = searchParams.get("category");
    return slug ? (getCategoryBySlug(slug)?.name || "") : "";
  });
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
  const [selectedExp, setSelectedExp] = useState<string[]>([]);
  const [selectedSoftware, setSelectedSoftware] = useState<string[]>([]);

  const togglePrice = (label: string) =>
    setSelectedPrices((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  const toggleExp = (label: string) =>
    setSelectedExp((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  const toggleSoftware = (s: string) =>
    setSelectedSoftware((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    selectedPrices.length +
    selectedExp.length +
    selectedSoftware.length;

  const clearFilters = () => {
    setSelectedCategory("");
    setSelectedPrices([]);
    setSelectedExp([]);
    setSelectedSoftware([]);
    setSearchTerm("");
    setPage(1);
  };

  const freelancersQuery = useQuery({
    queryKey: ["freelancers-page", user?.id],
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const data = await getBrowseExpertsList();
      return {
        freelancers: data.freelancers || [],
        savedIds: new Set<string>(data.savedIds || []),
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

    // Text search
    const term = searchTerm.toLowerCase().replace(/^@/, "");
    if (
      term &&
      !((p.full_name || "").toLowerCase().includes(term)) &&
      !((p.username || "").toLowerCase().includes(term)) &&
      !((f.title || "").toLowerCase().includes(term)) &&
      !((f.skills || []).some((s: string) => s.toLowerCase().includes(term)))
    )
      return false;

    // Category
    if (
      selectedCategory &&
      !((f.title || "").toLowerCase().includes(selectedCategory.toLowerCase())) &&
      !((f.skills || []).some((s: string) =>
        s.toLowerCase().includes(selectedCategory.toLowerCase())
      )) &&
      !((p.occupation || "").toLowerCase().includes(selectedCategory.toLowerCase()))
    )
      return false;

    // Price range (hourly_rate)
    if (selectedPrices.length > 0) {
      const rate = f.hourly_rate || 0;
      const matches = selectedPrices.some((label) => {
        const r = PRICE_RANGES.find((x) => x.label === label);
        return r ? rate >= r.min && rate <= r.max : false;
      });
      if (!matches) return false;
    }

    // Experience
    if (selectedExp.length > 0) {
      const yrs = f.years_experience ?? 0;
      const matches = selectedExp.some((label) => {
        const e = EXP_LEVELS.find((x) => x.label === label);
        return e ? yrs >= e.min && yrs <= e.max : false;
      });
      if (!matches) return false;
    }

    // Software tools (multi)
    if (selectedSoftware.length > 0) {
      const skills: string[] = f.skills || [];
      if (!selectedSoftware.some((sw) => skills.includes(sw))) return false;
    }

    return true;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      } catch {
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

  const sidebarProps: SidebarProps = {
    selectedCategory, setSelectedCategory: (v) => { setSelectedCategory(v); setPage(1); },
    selectedPrices, togglePrice: (l) => { togglePrice(l); setPage(1); },
    selectedExp, toggleExp: (l) => { toggleExp(l); setPage(1); },
    selectedSoftware, toggleSoftware: (s) => { toggleSoftware(s); setPage(1); },
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          {/* Search bar */}
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search experts by name, skill or title..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              />
            </div>

            {/* Mobile filter trigger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <FilterSidebar {...sidebarProps} />
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" /> Clear all filters
                  </Button>
                )}
              </SheetContent>
            </Sheet>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="hidden lg:flex items-center gap-1">
                <X className="h-4 w-4" /> Clear filters
              </Button>
            )}
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {selectedCategory && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  {selectedCategory}
                  <button onClick={() => { setSelectedCategory(""); setPage(1); }} className="ml-1 hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedPrices.map((l) => (
                <Badge key={l} variant="secondary" className="gap-1 pr-1">
                  {l}
                  <button onClick={() => { togglePrice(l); setPage(1); }} className="ml-1 hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedExp.map((l) => (
                <Badge key={l} variant="secondary" className="gap-1 pr-1">
                  {l}
                  <button onClick={() => { toggleExp(l); setPage(1); }} className="ml-1 hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedSoftware.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1 pr-1">
                  {s}
                  <button onClick={() => { toggleSoftware(s); setPage(1); }} className="ml-1 hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }}>
            <TabsList className="mb-6 w-full">
              <TabsTrigger value="all" className="flex-1">All Experts</TabsTrigger>
              <TabsTrigger value="saved" className="flex-1">
                <Heart className="h-4 w-4 mr-1.5" /> Saved
                {savedExperts.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5">{savedExperts.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── All Experts ── */}
            <TabsContent value="all">
              <div className="flex gap-8">
                {/* Desktop sidebar */}
                <aside className="hidden lg:block w-52 xl:w-60 shrink-0">
                  <div className="bg-card rounded-xl border border-border p-5 sticky top-6">
                    <FilterSidebar {...sidebarProps} />
                  </div>
                </aside>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground mb-5">
                    Showing <span className="font-semibold text-foreground">{filtered.length}</span> expert{filtered.length !== 1 ? "s" : ""}
                  </p>

                  {freelancersQuery.isPending && !freelancersQuery.data ? (
                    <FreelancerCardSkeleton count={6} />
                  ) : paginated.length === 0 ? (
                    <div className="text-center py-16">
                      <Search className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No experts found</h3>
                      <Button onClick={clearFilters}>Clear Filters</Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {paginated.map((f) => {
                        const p = f.profile;
                        return (
                          <div
                            key={f.id}
                            className="relative bg-card rounded-xl border border-border p-5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                            onClick={() => navigate(`/expert/${f.user_id}/profile`)}
                          >
                            {/* Heart — top right */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute top-3 right-3 h-7 w-7 p-0 z-10"
                              onClick={(e) => handleSaveExpert(e, f.user_id)}
                            >
                              <Heart className={`h-3.5 w-3.5 ${savedIds.has(f.user_id) ? "fill-current text-rose-500" : ""}`} />
                            </Button>

                            <div className="flex gap-3 mb-3 pr-8">
                              <Avatar className="h-12 w-12 shrink-0 border border-border">
                                <AvatarImage src={p?.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                  {(p?.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-foreground text-sm truncate">{p?.full_name}</span>
                                  {p?.is_verified && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{f.title || "CAD Professional"}</p>
                                <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                                  <Star className="h-3 w-3 fill-accent text-accent" />
                                  <span className="font-medium text-foreground">{f.rating || "0"}</span>
                                  <span>({f.total_jobs_completed || 0})</span>
                                  {p?.state && (
                                    <>
                                      <span className="mx-0.5">·</span>
                                      <MapPin className="h-3 w-3" />
                                      <span className="truncate">{p.city ? `${p.city}, ` : ""}{p.state}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {f.skills?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {f.skills.slice(0, 4).map((s: string) => (
                                  <Badge key={s} variant="secondary" className="text-xs px-2 py-0">{s}</Badge>
                                ))}
                                {f.skills.length > 4 && (
                                  <Badge variant="secondary" className="text-xs px-2 py-0">+{f.skills.length - 4}</Badge>
                                )}
                              </div>
                            )}

                            <div className="pt-3 border-t border-border">
                              <p className="text-sm font-bold text-primary mb-2">
                                {f.hourly_rate ? `${format(f.hourly_rate)}/hr` : <span className="text-muted-foreground font-normal text-xs">Rate not set</span>}
                              </p>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(user ? `/post-job?invite=${f.user_id}&name=${encodeURIComponent(f.full_name || "Expert")}` : "/auth");
                                  }}
                                >
                                  Hire
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/expert/${f.user_id}/profile`); }}
                                >
                                  View Profile
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-10">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="h-8 w-8 flex items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          onClick={() => setPage(n)}
                          className={`h-8 w-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                            n === page
                              ? "bg-primary text-primary-foreground"
                              : "border border-border hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="h-8 w-8 flex items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── Saved Experts ── */}
            <TabsContent value="saved">
              {savedExperts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No saved experts yet</p>
                  <Button className="mt-4" onClick={() => setActiveTab("all")}>Browse Experts</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedExperts.map((item: any) => {
                    const f = item.freelancer;
                    const fp = item.freelancerProfile;
                    if (!f) return null;
                    return (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/expert/${item.freelancer_id}/profile`)}
                        className="bg-card rounded-xl border border-border p-5 hover:border-primary/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex gap-3">
                            <Avatar className="h-11 w-11 shrink-0">
                              <AvatarImage src={f.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {(f.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-foreground text-sm">{f.full_name}</p>
                              {fp?.title && <p className="text-xs text-primary">{fp.title}</p>}
                              {f.state && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3" />{f.city ? `${f.city}, ` : ""}{f.state}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 shrink-0"
                            onClick={(e) => removeSaved(e, item.id, item.freelancer_id)}
                          >
                            <Heart className="h-3.5 w-3.5 fill-current" />
                          </Button>
                        </div>
                        {fp && (
                          <div className="flex items-center gap-1.5 text-xs mb-2">
                            <Star className="h-3 w-3 fill-accent text-accent" />
                            <span className="font-medium">{fp.rating || "0"}</span>
                            <span className="text-muted-foreground">({fp.total_jobs_completed || 0} jobs)</span>
                          </div>
                        )}
                        {fp?.skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {fp.skills.slice(0, 3).map((s: string) => (
                              <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
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
