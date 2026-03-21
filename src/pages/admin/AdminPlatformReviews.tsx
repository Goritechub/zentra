import { useState, useEffect } from "react";
import {
  deleteAdminPlatformReview,
  getAdminPlatformReviews,
  setAdminPlatformReviewApproval,
  setAdminPlatformReviewFeatured,
} from "@/api/admin.api";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Star, Trash2, CheckCircle2, Eye, Award } from "lucide-react";

export default function AdminPlatformReviews() {
  useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void fetchReviews(); }, []);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const data = await getAdminPlatformReviews();
      setReviews(data.reviews || []);
    } finally {
      setLoading(false);
    }
  };

  const toggleApproval = async (id: string, current: boolean) => {
    try {
      await setAdminPlatformReviewApproval(id, !current);
      setReviews(prev => prev.map(r => r.id === id ? { ...r, is_approved: !current } : r));
      toast.success(!current ? "Review approved" : "Review unapproved");
    } catch {
      toast.error("Failed to update approval");
    }
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    try {
      await setAdminPlatformReviewFeatured(id, !current);
      setReviews(prev => prev.map(r => r.id === id ? { ...r, is_featured: !current } : r));
      toast.success(!current ? "Review featured" : "Review unfeatured");
    } catch {
      toast.error("Failed to update featured status");
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Delete this platform review?")) return;
    try {
      await deleteAdminPlatformReview(id);
      setReviews(prev => prev.filter(r => r.id !== id));
      toast.success("Review deleted");
    } catch {
      toast.error("Failed to delete review");
    }
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
