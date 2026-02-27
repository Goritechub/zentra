import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { ShoppingBag, Loader2, MessageSquare, Clock, ArrowLeft, Star, Search, X } from "lucide-react";

const CATEGORIES = [
  "Product Design", "CAD Drafting", "3D Modeling", "3D Printing",
  "Structural Design", "Architectural Design", "Mechanical Design",
  "Electrical Design", "BIM/Revit", "Civil Engineering",
];

export default function BrowseServicesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchServices();
  }, [user, authLoading]);

  const fetchServices = async () => {
    const { data } = await supabase
      .from("service_offers" as any)
      .select("*, freelancer:profiles!service_offers_freelancer_id_fkey(full_name, avatar_url), freelancer_profile:freelancer_profiles!service_offers_freelancer_id_fkey(rating)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setServices((data as any[]) || []);
    setLoading(false);
  };

  const filtered = services.filter(svc => {
    if (categoryFilter && svc.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return svc.title.toLowerCase().includes(q) || svc.description?.toLowerCase().includes(q) || svc.skills?.some((s: string) => s.toLowerCase().includes(q));
    }
    return true;
  });

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
          <h1 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-primary" /> Browse Services
          </h1>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                className="pl-10"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {(categoryFilter || searchQuery) && (
              <Button variant="outline" size="sm" onClick={() => { setCategoryFilter(""); setSearchQuery(""); }}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No services found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((svc: any) => (
                <div key={svc.id} className="bg-card rounded-xl border border-border overflow-hidden card-hover">
                  {/* Banner placeholder */}
                  <div className="h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    {svc.banner_image ? (
                      <img src={svc.banner_image} alt={svc.title} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="h-10 w-10 text-primary/30" />
                    )}
                  </div>

                  <div className="p-5">
                    {svc.category && <Badge variant="secondary" className="mb-2 text-xs">{svc.category}</Badge>}
                    <h3 className="font-semibold text-lg text-foreground line-clamp-1">{svc.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{svc.description}</p>

                    {svc.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {svc.skills.slice(0, 3).map((s: string) => (
                          <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                      <div>
                        {svc.price && (
                          <p className="font-bold text-primary">
                            {svc.pricing_type === "starting_from" ? "From " : ""}{formatNaira(svc.price)}
                          </p>
                        )}
                        {svc.delivery_days && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />{svc.delivery_days} {svc.delivery_unit || "days"}
                          </p>
                        )}
                      </div>
                    </div>

                    {svc.freelancer && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                        <Link to={`/expert/${svc.freelancer_id}/profile`} className="text-xs text-muted-foreground hover:text-primary">
                          by {(svc.freelancer as any).full_name}
                        </Link>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/messages?user=${svc.freelancer_id}`)}>
                          <MessageSquare className="h-4 w-4 mr-1" />Message
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
