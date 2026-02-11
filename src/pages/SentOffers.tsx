import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { Send, Loader2, Clock, CheckCircle2, X, ArrowLeft } from "lucide-react";

export default function SentOffersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchOffers();
  }, [user, authLoading]);

  const fetchOffers = async () => {
    const { data } = await supabase
      .from("offers" as any)
      .select("*")
      .eq("client_id", user!.id)
      .order("created_at", { ascending: false });
    setOffers((data as any[]) || []);
    setLoading(false);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-accent" />;
      case "accepted": return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "rejected": return <X className="h-4 w-4 text-destructive" />;
      default: return null;
    }
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
          <h1 className="text-3xl font-bold text-foreground mb-8">Sent Offers</h1>
          {offers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No offers sent yet</p>
              <p className="text-sm mt-1">Send direct offers to experts from their profiles</p>
            </div>
          ) : (
            <div className="space-y-4">
              {offers.map((offer: any) => (
                <div key={offer.id} className="bg-card rounded-xl border border-border p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{offer.title}</h3>
                      {offer.description && <p className="text-sm text-muted-foreground mt-1">{offer.description}</p>}
                      <p className="text-xs text-muted-foreground mt-2">
                        Sent {formatDistanceToNow(new Date(offer.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="text-right">
                      {offer.budget && <p className="font-bold text-primary">{formatNaira(offer.budget)}</p>}
                      <Badge variant={offer.status === "accepted" ? "default" : "secondary"} className="mt-2 gap-1">
                        {statusIcon(offer.status)} {offer.status}
                      </Badge>
                    </div>
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
