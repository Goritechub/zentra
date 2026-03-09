import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Heart, Loader2, MapPin, Star, Trash2, ArrowLeft } from "lucide-react";
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
    // Fetch saved experts with profile and freelancer_profile data
    const { data } = await supabase
      .from("saved_experts" as any)
      .select("*, freelancer:profiles!saved_experts_freelancer_id_fkey(*)")
      .eq("client_id", user!.id)
      .order("created_at", { ascending: false });

    const savedData = (data as any[]) || [];

    // Fetch freelancer_profiles for rating/title/skills
    if (savedData.length > 0) {
      const freelancerIds = savedData.map((s: any) => s.freelancer_id).filter(Boolean);
      const { data: fpData } = await supabase
        .from("freelancer_profiles")
        .select("*")
        .in("user_id", freelancerIds);

      // Merge freelancer profile data
      savedData.forEach((item: any) => {
        item.freelancerProfile = (fpData || []).find((fp: any) => fp.user_id === item.freelancer_id);
      });
    }

    setSaved(savedData);
    setLoading(false);
  };

  const removeSaved = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    await supabase.from("saved_experts" as any).delete().eq("id", id);
    setSaved(saved.filter((s: any) => s.id !== id));
    toast.success("Expert removed from saved list");
  };

  const getRelativeTime = (dateStr: string) => {
    return `Saved ${formatDistanceToNow(new Date(dateStr), { addSuffix: true })}`;
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
                const fp = item.freelancerProfile;
                if (!f) return null;
                return (
                  <Link
                    key={item.id}
                    to={`/messages?user=${item.freelancer_id}`}
                    className="block bg-card rounded-xl border border-border p-6 card-hover transition-all hover:border-primary/30"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={f.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {(f.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={(e) => removeSaved(e, item.id)}>
                          <Heart className="h-4 w-4 fill-current" />
                        </Button>
                      </div>
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
                      {getRelativeTime(item.created_at)}
                    </p>
                  </Link>
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
