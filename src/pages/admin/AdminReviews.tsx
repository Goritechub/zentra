import { useState, useEffect } from "react";
import { deleteAdminReview, getAdminReviews } from "@/api/admin.api";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Star, Trash2 } from "lucide-react";

export default function AdminReviews() {
  useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void fetchReviews(); }, []);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const data = await getAdminReviews();
      setReviews(data.reviews || []);
    } finally {
      setLoading(false);
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Delete this review? This cannot be undone.")) return;
    try {
      await deleteAdminReview(id);
      setReviews(prev => prev.filter(r => r.id !== id));
      toast.success("Review deleted");
    } catch {
      toast.error("Failed to delete review");
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Reviews & Ratings</h1>
      <Badge variant="secondary" className="mb-4">{reviews.length} reviews</Badge>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reviewer</TableHead>
              <TableHead>Reviewee</TableHead>
              <TableHead>Contract</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-sm font-medium">{r.reviewer?.full_name || "—"}</TableCell>
                <TableCell className="text-sm">{r.reviewee?.full_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{r.contract?.job_title || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-medium">{r.rating}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.comment || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteReview(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
