import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatNaira } from "@/lib/nigerian-data";
import { Loader2, Search, Eye, ShieldCheck, Ban, UserCheck, Wallet, Trash2, AlertTriangle, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userWallet, setUserWallet] = useState<any>(null);
  const [userViolations, setUserViolations] = useState<any>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closingAccount, setClosingAccount] = useState(false);
  const [notifyingUser, setNotifyingUser] = useState(false);
  const [frozenWithdrawalUsers, setFrozenWithdrawalUsers] = useState<Record<string, boolean>>({});
  const [togglingWithdrawal, setTogglingWithdrawal] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const [profilesRes, rolesRes, permsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      supabase.from("admin_permissions").select("user_id, permission").eq("permission", "admin_management"),
    ]);
    const adminIds = new Set((rolesRes.data || []).map((r: any) => r.user_id));
    const superAdminIds = new Set((permsRes.data || []).map((p: any) => p.user_id));
    const enriched = (profilesRes.data || []).map((u: any) => ({
      ...u,
      display_role: superAdminIds.has(u.id) ? "superadmin" : adminIds.has(u.id) ? "admin" : u.role,
    }));
    setUsers(enriched);
    setLoading(false);
  };

  const viewUser = async (u: any) => {
    setSelectedUser(u);
    const [walletRes, violRes] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", u.id).maybeSingle(),
      supabase.from("user_violation_counts").select("*").eq("user_id", u.id).maybeSingle(),
    ]);
    setUserWallet(walletRes.data);
    setUserViolations(violRes.data);
  };

  const toggleVerification = async (userId: string, current: boolean) => {
    await supabase.from("profiles").update({ is_verified: !current }).eq("id", userId);
    await logAction("toggle_verification", "user", userId, { verified: !current });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: !current } : u));
    setSelectedUser((prev: any) => prev ? { ...prev, is_verified: !current } : prev);
    toast.success(current ? "User unverified" : "User verified");
  };

  const toggleSuspension = async (userId: string, isSuspended: boolean) => {
    await supabase.from("user_violation_counts")
      .upsert({ user_id: userId, is_suspended: !isSuspended, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    await logAction("toggle_suspension", "user", userId, { suspended: !isSuspended });
    setUserViolations((prev: any) => prev ? { ...prev, is_suspended: !isSuspended } : { user_id: userId, is_suspended: !isSuspended, total_violations: 0 });
    toast.success(isSuspended ? "User unsuspended" : "User suspended");
  };

  const logAction = async (action: string, targetType: string, targetId: string, details: any) => {
    await supabase.from("admin_activity_log").insert({
      admin_id: user!.id, action, target_type: targetType, target_id: targetId, details,
    });
  };

  const closeAccount = async (targetUser: any) => {
    setClosingAccount(true);
    try {
      const { data, error } = await supabase.rpc("admin_close_user_account", {
        _admin_id: user!.id,
        _target_user_id: targetUser.id,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        if (result.code === "has_funds") {
          toast.error(`User has funds: Balance ${formatNaira(result.wallet_balance)}, Escrow ${formatNaira(result.escrow_balance)}. Send withdrawal reminder first.`);
        } else if (result.code === "has_active_contracts") {
          toast.error(`User has ${result.active_contracts} active contract(s). Cannot close account.`);
        } else {
          toast.error(result.error);
        }
        setShowCloseConfirm(false);
        setClosingAccount(false);
        return;
      }
      setUsers(prev => prev.filter(u => u.id !== targetUser.id));
      setSelectedUser(null);
      setShowCloseConfirm(false);
      toast.success("Account permanently closed and deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to close account");
    } finally {
      setClosingAccount(false);
    }
  };

  const sendWithdrawReminder = async (targetUser: any) => {
    setNotifyingUser(true);
    try {
      const walletBalance = userWallet?.balance || 0;
      const escrowBalance = userWallet?.escrow_balance || 0;
      const totalFunds = walletBalance + escrowBalance;

      // Send in-app notification
      await supabase.from("notifications").insert({
        user_id: targetUser.id,
        title: "Action Required: Withdraw Your Funds",
        message: `Your account has been flagged for closure. You currently have ${formatNaira(totalFunds)} in your wallet. Please withdraw all funds immediately to avoid any issues. Contact support if you need assistance.`,
        type: "platform_announcement",
        link_url: "/dashboard",
      });

      await logAction("send_withdraw_reminder", "user", targetUser.id, {
        wallet_balance: walletBalance,
        escrow_balance: escrowBalance,
      });

      toast.success("Withdrawal reminder notification sent to user");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reminder");
    } finally {
      setNotifyingUser(false);
    }
  };

  const getDisplayRole = (role: string) => {
    switch (role) {
      case "superadmin": return "Super Admin";
      case "admin": return "Admin";
      case "freelancer": return "Expert";
      default: return "Client";
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.username?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.display_role === roleFilter;
    return matchSearch && matchRole;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Users Management</h1>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, username..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="freelancer">Expert</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="superadmin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filtered.length} users</Badge>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(u => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={u.avatar_url} />
                      <AvatarFallback>{(u.full_name || u.email || "U")[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{u.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.display_role === "superadmin" ? "default" : "outline"} className={u.display_role === "superadmin" ? "bg-primary text-primary-foreground" : "capitalize"}>
                    {getDisplayRole(u.display_role)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.is_verified ? <ShieldCheck className="h-4 w-4 text-primary" /> : <span className="text-xs text-muted-foreground">No</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => viewUser(u)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser.avatar_url} />
                  <AvatarFallback className="text-lg">{(selectedUser.full_name || "U")[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.full_name || "—"}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={selectedUser.display_role === "superadmin" ? "default" : "outline"} className={selectedUser.display_role === "superadmin" ? "bg-primary text-primary-foreground" : "capitalize"}>
                      {getDisplayRole(selectedUser.display_role)}
                    </Badge>
                    {selectedUser.is_verified && <Badge className="bg-primary/10 text-primary">Verified</Badge>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Username:</span> <span className="font-medium">{selectedUser.username || "—"}</span></div>
                <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{selectedUser.phone || "—"}</span></div>
                <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{[selectedUser.city, selectedUser.state].filter(Boolean).join(", ") || "—"}</span></div>
                <div><span className="text-muted-foreground">WhatsApp:</span> <span className="font-medium">{selectedUser.whatsapp || "—"}</span></div>
              </div>

              {/* Wallet */}
              {userWallet && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Wallet</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Balance: <span className="font-bold text-primary">{formatNaira(userWallet.balance)}</span></div>
                    <div>Escrow: <span className="font-bold text-amber-500">{formatNaira(userWallet.escrow_balance)}</span></div>
                    <div>Total Earned: <span className="font-medium">{formatNaira(userWallet.total_earned)}</span></div>
                    <div>Total Spent: <span className="font-medium">{formatNaira(userWallet.total_spent)}</span></div>
                  </div>
                </div>
              )}

              {/* Violations */}
              {userViolations && userViolations.total_violations > 0 && (
                <div className="bg-destructive/5 rounded-lg p-4 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive">{userViolations.total_violations} violation(s)</p>
                  <p className="text-xs text-muted-foreground">
                    {userViolations.is_suspended ? "Currently suspended" : "Account active"}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant={selectedUser.is_verified ? "outline" : "default"} onClick={() => toggleVerification(selectedUser.id, selectedUser.is_verified)}>
                  <UserCheck className="h-4 w-4 mr-1" />
                  {selectedUser.is_verified ? "Unverify" : "Verify"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => toggleSuspension(selectedUser.id, userViolations?.is_suspended || false)}>
                  <Ban className="h-4 w-4 mr-1" />
                  {userViolations?.is_suspended ? "Unsuspend" : "Suspend"}
                </Button>
                {selectedUser.display_role !== "superadmin" && (
                  <>
                    {userWallet && (userWallet.balance > 0 || userWallet.escrow_balance > 0) ? (
                      <Button size="sm" variant="outline" className="border-amber-500 text-amber-600" onClick={() => sendWithdrawReminder(selectedUser)} disabled={notifyingUser}>
                        {notifyingUser ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-1" />}
                        Send Withdraw Reminder
                      </Button>
                    ) : (
                      <Button size="sm" variant="destructive" className="bg-destructive/90" onClick={() => setShowCloseConfirm(true)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Close Account
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Close Account Confirmation */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Permanently Close Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold text-foreground">{selectedUser?.full_name || selectedUser?.email}</span>'s account and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closingAccount}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={closingAccount}
              onClick={(e) => {
                e.preventDefault();
                if (selectedUser) closeAccount(selectedUser);
              }}
            >
              {closingAccount ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
