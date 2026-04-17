import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { getBrowseServicesList } from "@/api/client-read.api";
import { formatNaira } from "@/lib/nigerian-data";
import { cadSoftwareList } from "@/lib/nigerian-data";
import { categoryNames } from "@/lib/categories";
import {
  Search, X, SlidersHorizontal, Star, Clock, Send, ChevronLeft, ChevronRight,
} from "lucide-react";
import { ServiceCardSkeleton } from "@/components/skeletons/ServiceCardSkeleton";

const PAGE_SIZE = 9;

const PRICE_RANGES = [
  { label: "Under ₦15,000", min: 0, max: 14_999 },
  { label: "₦15,000 – ₦75,000", min: 15_000, max: 75_000 },
  { label: "₦75,000 – ₦300,000", min: 75_001, max: 300_000 },
  { label: "₦300,000+", min: 300_001, max: Infinity },
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

      <div>
        <p className="font-semibold text-foreground mb-2">Price Range</p>
        <div className="space-y-2">
          {PRICE_RANGES.map((r) => (
            <label key={r.label} className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox checked={selectedPrices.includes(r.label)} onCheckedChange={() => togglePrice(r.label)} />
              <span className="text-muted-foreground leading-none">{r.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <p className="font-semibold text-foreground mb-2">Software Tools</p>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {cadSoftwareList.map((s) => (
            <label key={s} className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox checked={selectedSoftware.includes(s)} onCheckedChange={() => toggleSoftware(s)} />
              <span className="text-muted-foreground leading-none">{s}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BrowseServicesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [galleryIdx, setGalleryIdx] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
  const [selectedExp, setSelectedExp] = useState<string[]>([]);
  const [selectedSoftware, setSelectedSoftware] = useState<string[]>([]);

  const togglePrice = (l: string) => setSelectedPrices((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l]);
  const toggleExp = (l: string) => setSelectedExp((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l]);
  const toggleSoftware = (s: string) => setSelectedSoftware((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  const activeFilterCount =
    (selectedCategory ? 1 : 0) + selectedPrices.length + selectedExp.length + selectedSoftware.length;

  const clearFilters = () => {
    setSelectedCategory(""); setSelectedPrices([]); setSelectedExp([]); setSelectedSoftware([]);
    setSearchQuery(""); setPage(1);
  };

  const servicesQuery = useQuery({
    queryKey: ["browse-services"],
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const response = await getBrowseServicesList();
      return (response.data.services as any[]) || [];
    },
  });

  const services = servicesQuery.data || [];

  const filtered = services.filter((svc) => {
    if (selectedCategory && svc.category !== selectedCategory) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const freelancer = svc.freelancer as any;
      if (
        !freelancer?.full_name?.toLowerCase().includes(q) &&
        !freelancer?.username?.toLowerCase().includes(q) &&
        !svc.title?.toLowerCase().includes(q) &&
        !svc.description?.toLowerCase().includes(q) &&
        !(svc.skills || []).some((s: string) => s.toLowerCase().includes(q))
      )
        return false;
    }

    if (selectedPrices.length > 0) {
      const price = svc.price || 0;
      const matches = selectedPrices.some((label) => {
        const r = PRICE_RANGES.find((x) => x.label === label);
        return r ? price >= r.min && price <= r.max : false;
      });
      if (!matches) return false;
    }

    // Experience level filter via freelancer_years_experience (if available) — skip if not present
    if (selectedExp.length > 0 && svc.freelancer_years_experience != null) {
      const yrs = svc.freelancer_years_experience;
      const matches = selectedExp.some((label) => {
        const e = EXP_LEVELS.find((x) => x.label === label);
        return e ? yrs >= e.min && yrs <= e.max : false;
      });
      if (!matches) return false;
    }

    if (selectedSoftware.length > 0) {
      const skills: string[] = svc.skills || [];
      if (!selectedSoftware.some((sw) => skills.includes(sw))) return false;
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const svcImages = selectedService?.images || [];

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
          {/* Search + mobile filter trigger */}
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, skill, or keyword..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
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
                  <button onClick={() => { setSelectedCategory(""); setPage(1); }}><X className="h-3 w-3 ml-1" /></button>
                </Badge>
              )}
              {selectedPrices.map((l) => (
                <Badge key={l} variant="secondary" className="gap-1 pr-1">
                  {l}<button onClick={() => { togglePrice(l); setPage(1); }}><X className="h-3 w-3 ml-1" /></button>
                </Badge>
              ))}
              {selectedExp.map((l) => (
                <Badge key={l} variant="secondary" className="gap-1 pr-1">
                  {l}<button onClick={() => { toggleExp(l); setPage(1); }}><X className="h-3 w-3 ml-1" /></button>
                </Badge>
              ))}
              {selectedSoftware.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1 pr-1">
                  {s}<button onClick={() => { toggleSoftware(s); setPage(1); }}><X className="h-3 w-3 ml-1" /></button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-8">
            {/* Desktop sidebar */}
            <aside className="hidden lg:block w-52 xl:w-60 shrink-0">
              <div className="bg-card rounded-xl border border-border p-5 sticky top-6">
                <FilterSidebar {...sidebarProps} />
              </div>
            </aside>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-5">
                Showing <span className="font-semibold text-foreground">{filtered.length}</span> service{filtered.length !== 1 ? "s" : ""}
              </p>

              {servicesQuery.isPending && !servicesQuery.data ? (
                <ServiceCardSkeleton count={6} />
              ) : paginated.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No services found</p>
                  <Button className="mt-4" variant="outline" onClick={clearFilters}>Clear Filters</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paginated.map((svc: any) => {
                    const freelancer = svc.freelancer as any;
                    return (
                      <div
                        key={svc.id}
                        className="bg-card rounded-xl border border-border p-5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer flex flex-col"
                        onClick={() => { setSelectedService(svc); setGalleryIdx(0); }}
                      >
                        {/* Expert header */}
                        <div className="flex items-center gap-2.5 mb-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={freelancer?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {(freelancer?.full_name || "U")[0]}
                            </AvatarFallback>
                          </Avatar>
                          <Link
                            to={`/expert/${svc.freelancer_id}/profile`}
                            className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {freelancer?.full_name || "Expert"}
                          </Link>
                        </div>

                        {/* Service title + description */}
                        <h3 className="font-semibold text-foreground line-clamp-2 mb-1 leading-snug">{svc.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{svc.description}</p>

                        {/* Rating */}
                        {(svc.freelancer_rating != null || svc.freelancer_jobs > 0) && (
                          <div className="flex items-center gap-1.5 mt-3 text-xs">
                            <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                            <span className="font-medium text-foreground">{(svc.freelancer_rating || 0).toFixed(1)}</span>
                            <span className="text-muted-foreground">({svc.freelancer_jobs || 0})</span>
                          </div>
                        )}

                        {/* Price footer */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                          {svc.delivery_days && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />{svc.delivery_days} {svc.delivery_unit || "days"}
                            </span>
                          )}
                          <span className="ml-auto text-sm font-bold text-primary">
                            {svc.price ? (
                              <>{svc.pricing_type === "starting_from" ? "Starting at " : ""}{formatNaira(svc.price)}</>
                            ) : "Negotiable"}
                          </span>
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
        </div>
      </main>
      <Footer />

      {/* Service Detail Dialog */}
      <Dialog open={!!selectedService} onOpenChange={() => setSelectedService(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedService?.title}</DialogTitle>
            {selectedService?.category && (
              <DialogDescription>{selectedService.category}</DialogDescription>
            )}
          </DialogHeader>

          {svcImages.length > 0 && (
            <div className="space-y-3">
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <img src={svcImages[galleryIdx]} alt={`Service image ${galleryIdx + 1}`} className="w-full h-full object-cover" />
                {svcImages.length > 1 && (
                  <>
                    <button onClick={() => setGalleryIdx((i) => (i - 1 + svcImages.length) % svcImages.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1.5 hover:bg-background">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button onClick={() => setGalleryIdx((i) => (i + 1) % svcImages.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1.5 hover:bg-background">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              {svcImages.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {svcImages.map((url: string, i: number) => (
                    <button key={i} onClick={() => setGalleryIdx(i)}
                      className={`aspect-video bg-muted rounded-lg overflow-hidden border-2 transition-colors ${i === galleryIdx ? "border-primary" : "border-transparent"}`}>
                      <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 py-2">
            {selectedService?.freelancer && (
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={(selectedService.freelancer as any).avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {((selectedService.freelancer as any).full_name || "U")[0]}
                  </AvatarFallback>
                </Avatar>
                <Link to={`/expert/${selectedService.freelancer_id}/profile`}
                  className="text-sm font-medium hover:text-primary"
                  onClick={() => setSelectedService(null)}>
                  {(selectedService.freelancer as any).full_name}
                </Link>
              </div>
            )}

            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedService?.description}</p>

            <div className="flex flex-wrap gap-4 text-sm">
              {selectedService?.price && (
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="font-bold text-primary">
                    {selectedService.pricing_type === "starting_from" ? "Starting at " : ""}
                    {formatNaira(selectedService.price)}
                  </p>
                </div>
              )}
              {selectedService?.delivery_days && (
                <div>
                  <p className="text-xs text-muted-foreground">Delivery</p>
                  <p className="font-medium">{selectedService.delivery_days} {selectedService.delivery_unit || "days"}</p>
                </div>
              )}
              {selectedService?.revisions_allowed && (
                <div>
                  <p className="text-xs text-muted-foreground">Revisions</p>
                  <p className="font-medium">{selectedService.revisions_allowed}</p>
                </div>
              )}
            </div>

            {selectedService?.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedService.skills.map((s: string) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSelectedService(null)}>Close</Button>
            {selectedService?.freelancer_id && (
              <>
                <Button variant="outline" onClick={() => { setSelectedService(null); navigate(`/expert/${selectedService.freelancer_id}/profile`); }}>
                  View Profile
                </Button>
                <Button onClick={() => { setSelectedService(null); navigate(`/messages?user=${selectedService.freelancer_id}`); }}>
                  <Send className="h-4 w-4 mr-2" /> Hire Expert
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
