import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { ShoppingBag, Loader2, MessageSquare, Clock } from "lucide-react";

export default function BrowseServicesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchServices();
  }, [user, authLoading]);

  const fetchServices = async () => {
    const { data } = await supabase
      .from("service_offers" as any)
      .select("*, freelancer:profiles!service_offers_freelancer_id_fkey(*)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setServices((data as any[]) || []);
    setLoading(false);
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div><Footer /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <h1 className="text-3xl font-bold text-foreground mb-8">Browse Service Offers</h1>
          {services.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No service offers available yet</p>
              <p className="text-sm mt-1">Experts will list their services here soon</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((svc: any) => (
                <div key={svc.id} className="bg-card rounded-xl border border-border p-6 card-hover">
                  <div className="mb-4">
                    {svc.category && <Badge variant="secondary" className="mb-2">{svc.category}</Badge>}
                    <h3 className="font-semibold text-lg text-foreground">{svc.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{svc.description}</p>
                  </div>
                  {svc.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {svc.skills.slice(0, 3).map((s: string) => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      {svc.price && <p className="font-bold text-primary">{formatNaira(svc.price)}</p>}
                      {svc.delivery_days && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />{svc.delivery_days} days
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/messages?user=${svc.freelancer_id}`)}>
                      <MessageSquare className="h-4 w-4 mr-1" />Message
                    </Button>
                  </div>
                  {svc.freelancer && (
                    <p className="text-xs text-muted-foreground mt-3">by {svc.freelancer.full_name}</p>
                  )}
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
