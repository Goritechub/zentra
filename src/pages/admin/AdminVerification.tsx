import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Eye, ShieldCheck, Star, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  not_started: { label: "Not Started", icon: ShieldCheck, color: "text-muted-foreground" },
  pending: { label: "Pending", icon: Clock, color: "text-accent" },
  verified: { label: "Verified", icon: CheckCircle2, color: "text-primary" },
  failed: { label: "Failed", icon: XCircle, color: "text-destructive" },
  manual_review: { label: "Manual Review", icon: AlertTriangle, color: "text-accent" },
};

export default function AdminVerification() {
  const { user } = useAuth();
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedKyc, setSelectedKyc] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchVerifications(); }, []);

  const fetchVerifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("kyc_verifications" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const userIds = data.map((v: any) => v.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, role, username")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      setVerifications(data.map((v: any) => ({ ...v, profile: profileMap.get(v.user_id) })));
    } else {
      setVerifications([]);
    }
    setLoading(false);
  };

  const handleApproveKyc = async (kycId: string, userId: string) => {
    setSaving(true);
    await supabase
      .from("kyc_verifications" as any)
      .update({ kyc_status: "verified", verification_level: "identity_verified" })
      .eq("id", kycId);
    await supabase.from("profiles").update({ is_verified: true }).eq("id", userId);
    await logAction("approve_kyc", "user", userId, { kyc_id: kycId });
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Identity Verified ✓",
      message: "Your identity has been verified by an admin.",
      type: "verification",
    });
    toast.success("KYC approved");
    setSaving(false);
    await fetchVerifications();
    setSelectedKyc(null);
  };

  const handleRejectKyc = async (kycId: string, userId: string) => {
    setSaving(true);
    await supabase
      .from("kyc_verifications" as any)
      .update({ kyc_status: "failed", admin_notes: adminNotes })
      .eq("id", kycId);
    await logAction("reject_kyc", "user", userId, { kyc_id: kycId, notes: adminNotes });
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Verification Rejected",
      message: adminNotes || "Your identity verification was not approved.",
      type: "verification",
    });
    toast.success("KYC rejected");
    setSaving(false);
    await fetchVerifications();
    setSelectedKyc(null);
  };

  const handleGrantZentraVerified = async (kycId: string, userId: string) => {
    setSaving(true);
    await supabase
      .from("kyc_verifications" as any)
      .update({
        zentra_verified: true,
        zentra_verified_at: new Date().toISOString(),
        zentra_verified_by: user!.id,
        verification_level: "zentra_verified",
      })
      .eq("id", kycId);
    await logAction("grant_zentra_verified", "user", userId, { kyc_id: kycId });
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "⭐ ZentraGig Verified Engineer",
      message: "Congratulations! You've been awarded the ZentraGig Verified Engineer badge.",
      type: "verification",
    });
    toast.success("ZentraGig Verified badge granted");
    setSaving(false);
    await fetchVerifications();
    setSelectedKyc(null);
  };

  const handleRevokeZentraVerified = async (kycId: string, userId: string) => {
    setSaving(true);
    await supabase
      .from("kyc_verifications" as any)
      .update({
        zentra_verified: false,
        zentra_verified_at: null,
        zentra_verified_by: null,
        verification_level: "identity_verified",
      })
      .eq("id", kycId);
    await logAction("revoke_zentra_verified", "user", userId, { kyc_id: kycId });
    toast.success("ZentraGig Verified badge revoked");
    setSaving(false);
    await fetchVerifications();
    setSelectedKyc(null);
  };

  const logAction = async (action: string, targetType: string, targetId: string, details: any) => {
    await supabase.from("admin_activity_log").insert({
      admin_id: user!.id, action, target_type: targetType, target_id: targetId, details,
    });
  };

  const filtered = verifications.filter((v) => {
    const matchSearch = !search || 
      v.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.profile?.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || v.kyc_status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Verification Management</h1>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="manual_review">Manual Review</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filtered.length} requests</Badge>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>KYC Status</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>ZentraGig Badge</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No verification requests found
                </TableCell>
              </TableRow>
            )}
            {filtered.map((v: any) => {
              const statusConf = STATUS_CONFIG[v.kyc_status] || STATUS_CONFIG.not_started;
              const StatusIcon = statusConf.icon;
              return (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={v.profile?.avatar_url} />
                        <AvatarFallback>{(v.profile?.full_name || "U")[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{v.profile?.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{v.profile?.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`flex items-center gap-1.5 text-sm ${statusConf.color}`}>
                      <StatusIcon className="h-4 w-4" />
                      {statusConf.label}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {v.verification_level?.replace("_", " ") || "basic"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {v.zentra_verified ? (
                      <Badge className="bg-accent/15 text-accent border-accent/25 text-xs">⭐ Verified</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedKyc(v); setAdminNotes(v.admin_notes || ""); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedKyc} onOpenChange={() => setSelectedKyc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Verification Details</DialogTitle>
          </DialogHeader>
          {selectedKyc && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={selectedKyc.profile?.avatar_url} />
                  <AvatarFallback className="text-lg">{(selectedKyc.profile?.full_name || "U")[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{selectedKyc.profile?.full_name || "—"}</h3>
                  <p className="text-sm text-muted-foreground">{selectedKyc.profile?.email}</p>
                  <Badge variant="outline" className="capitalize mt-1">
                    {selectedKyc.profile?.role === "freelancer" ? "Expert" : selectedKyc.profile?.role}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">KYC Status:</span>{" "}
                  <span className={`font-medium ${STATUS_CONFIG[selectedKyc.kyc_status]?.color}`}>
                    {STATUS_CONFIG[selectedKyc.kyc_status]?.label}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Level:</span>{" "}
                  <span className="font-medium capitalize">{selectedKyc.verification_level?.replace("_", " ")}</span>
                </div>
                {selectedKyc.full_name_on_id && (
                  <div><span className="text-muted-foreground">Name on ID:</span> <span className="font-medium">{selectedKyc.full_name_on_id}</span></div>
                )}
                {selectedKyc.country && (
                  <div><span className="text-muted-foreground">Country:</span> <span className="font-medium">{selectedKyc.country}</span></div>
                )}
                {selectedKyc.document_type && (
                  <div><span className="text-muted-foreground">Document:</span> <span className="font-medium capitalize">{selectedKyc.document_type}</span></div>
                )}
                {selectedKyc.date_of_birth && (
                  <div><span className="text-muted-foreground">DOB:</span> <span className="font-medium">{selectedKyc.date_of_birth}</span></div>
                )}
              </div>

              {selectedKyc.kyc_provider_status && (
                <div className="p-3 rounded-lg bg-muted/50 text-xs">
                  <span className="text-muted-foreground">Provider Status:</span>{" "}
                  <span className="font-medium">{selectedKyc.kyc_provider_status}</span>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Admin Notes</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this verification..."
                  rows={3}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {(selectedKyc.kyc_status === "manual_review" || selectedKyc.kyc_status === "pending") && (
                  <>
                    <Button size="sm" onClick={() => handleApproveKyc(selectedKyc.id, selectedKyc.user_id)} disabled={saving}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve KYC
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleRejectKyc(selectedKyc.id, selectedKyc.user_id)} disabled={saving}>
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </>
                )}
                {selectedKyc.kyc_status === "verified" && !selectedKyc.zentra_verified && (
                  <Button size="sm" variant="default" onClick={() => handleGrantZentraVerified(selectedKyc.id, selectedKyc.user_id)} disabled={saving}>
                    <Star className="h-4 w-4 mr-1" /> Grant ZentraGig Verified
                  </Button>
                )}
                {selectedKyc.zentra_verified && (
                  <Button size="sm" variant="outline" onClick={() => handleRevokeZentraVerified(selectedKyc.id, selectedKyc.user_id)} disabled={saving}>
                    <XCircle className="h-4 w-4 mr-1" /> Revoke ZentraGig Badge
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
