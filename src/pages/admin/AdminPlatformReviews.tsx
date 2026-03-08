import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Star, Trash2, CheckCircle2, Eye, Award } from "lucide-react";

export default function AdminPlatformReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchReviews(); }, []);

  const fetchReviews = async () => {
    const { data } = await supabase
      .from("platform_reviews")
      .select("*, profiles:user_id(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(200);
    setReviews(data || []);
    setLoading(false);
  };

  const toggleApproval = async (id: string, current: boolean) => {
    await supabase.from("platform_reviews").update({ is_approved: !current }).eq("id", id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, is_approved: !current } : r));
    toast.success(!current ? "Review approved" : "Review unapproved");
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    await supabase.from("platform_reviews").update({ is_featured: !current }).eq("id", id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, is_featured: !current } : r));
    toast.success(!current ? "Review featured" : "Review unfeatured");
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Delete this platform review?")) return;
    await supabase.from("platform_reviews").delete().eq("id", id);
    await supabase.from("admin_activity_log").insert({
      admin_id: user!.id, action: "delete_platform_review", target_type: "platform_review", target_id: id, details: {},
    });
    setReviews(prev => prev.filter(r => r.id !== id));
    toast.success("Review deleted");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Platform Reviews</h1>
      <Badge variant="secondary" className="mb-4">{reviews.length} reviews</Badge>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-sm font-medium">{(r.profiles as any)?.full_name || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-medium">{r.rating}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{r.comment || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {r.is_approved && <Badge variant="default" className="text-xs">Approved</Badge>}
                    {r.is_featured && <Badge variant="secondary" className="text-xs">Featured</Badge>}
                    {!r.is_approved && !r.is_featured && <Badge variant="outline" className="text-xs">Pending</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => toggleApproval(r.id, r.is_approved)} title={r.is_approved ? "Unapprove" : "Approve"}>
                      <CheckCircle2 className={`h-4 w-4 ${r.is_approved ? "text-primary" : "text-muted-foreground"}`} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleFeatured(r.id, r.is_featured)} title={r.is_featured ? "Unfeature" : "Feature"}>
                      <Award className={`h-4 w-4 ${r.is_featured ? "text-accent" : "text-muted-foreground"}`} />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteReview(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
