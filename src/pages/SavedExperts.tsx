import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { Heart, Loader2, MapPin, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SavedExpertsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchSaved();
  }, [user, authLoading]);

  const fetchSaved = async () => {
    const { data } = await supabase
      .from("saved_experts" as any)
      .select("*, freelancer:profiles!saved_experts_freelancer_id_fkey(*)")
      .eq("client_id", user!.id)
      .order("created_at", { ascending: false });
    setSaved((data as any[]) || []);
    setLoading(false);
  };

  const removeSaved = async (id: string) => {
    await supabase.from("saved_experts" as any).delete().eq("id", id);
    setSaved(saved.filter((s: any) => s.id !== id));
    toast.success("Expert removed from saved list");
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div><Footer /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <h1 className="text-3xl font-bold text-foreground mb-8">Saved Experts</h1>
          {saved.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No saved experts yet</p>
              <Button className="mt-4" asChild><Link to="/freelancers">Browse Experts</Link></Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {saved.map((item: any) => {
                const f = item.freelancer;
                if (!f) return null;
                return (
                  <div key={item.id} className="bg-card rounded-xl border border-border p-6 card-hover">
                    <div className="flex items-start justify-between mb-4">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={f.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {(f.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <Button size="sm" variant="ghost" onClick={() => removeSaved(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <h3 className="font-semibold text-foreground">{f.full_name}</h3>
                    {f.state && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />{f.city ? `${f.city}, ` : ""}{f.state}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Saved {new Date(item.created_at).toLocaleDateString("en-NG")}
                    </p>
                  </div>
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
