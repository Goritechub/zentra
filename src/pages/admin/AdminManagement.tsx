import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_ADMIN_PERMISSIONS, PERMISSION_PRESETS } from "@/lib/admin-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Pencil, Trash2, ShieldCheck, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useOutletContext } from "react-router-dom";

interface Admin {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  permissions: string[];
  is_current_user: boolean;
}

export default function AdminManagement() {
  const { permissions: myPermissions } = useOutletContext<{ permissions: string[] }>();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPermissions, setNewPermissions] = useState<string[]>([]);

  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  const isSuperAdmin = myPermissions.includes("admin_management");

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-admin", {
        body: { action: "list_admins" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAdmins(data.admins || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newEmail || !newPassword || !newFullName) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-admin", {
        body: {
          action: "create_admin",
          email: newEmail,
          password: newPassword,
          fullName: newFullName,
          permissions: newPermissions,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Admin Created", description: `${newFullName} has been added as an admin.` });
      setShowCreate(false);
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewPermissions([]);
      fetchAdmins();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingAdmin) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-admin", {
        body: {
          action: "update_permissions",
          targetUserId: editingAdmin.id,
          permissions: editPermissions,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Permissions Updated", description: `Permissions for ${editingAdmin.full_name || editingAdmin.email} updated.` });
      setEditingAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (admin: Admin) => {
    if (!confirm(`Remove admin access for ${admin.full_name || admin.email}? They will become a regular user.`)) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-admin", {
        body: { action: "remove_admin", targetUserId: admin.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Admin Removed", description: "Admin access has been revoked." });
      fetchAdmins();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const togglePerm = (list: string[], setList: (l: string[]) => void, key: string) => {
    setList(list.includes(key) ? list.filter((p) => p !== key) : [...list, key]);
  };

  const PermissionCheckboxes = ({
    perms,
    setPerms,
  }: {
    perms: string[];
    setPerms: (p: string[]) => void;
  }) => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PERMISSION_PRESETS.map((preset) => (
          <Button
            key={preset.name}
            variant="outline"
            size="sm"
            onClick={() => setPerms([...preset.permissions])}
            className="text-xs"
          >
            {preset.name}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => setPerms([])} className="text-xs">
          Clear All
        </Button>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-3">
        {ALL_ADMIN_PERMISSIONS.map((perm) => (
          <label key={perm.key} className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              checked={perms.includes(perm.key)}
              onCheckedChange={() => togglePerm(perms, setPerms, perm.key)}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium">{perm.label}</div>
              <div className="text-xs text-muted-foreground">{perm.description}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );

  const getAdminType = (admin: Admin) => {
    if (admin.permissions.includes("admin_management")) return "Super Admin";
    if (admin.permissions.length === 0) return "No Permissions";
    for (const preset of PERMISSION_PRESETS) {
      if (
        preset.name !== "Super Admin" &&
        preset.permissions.length === admin.permissions.length &&
        preset.permissions.every((p) => admin.permissions.includes(p))
      ) {
        return preset.name;
      }
    }
    return "Custom";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Management</h1>
          <p className="text-muted-foreground">Manage admin accounts and their permissions</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Create Admin
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Accounts ({admins.length})</CardTitle>
          <CardDescription>All administrators with their assigned permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Role Type</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Added</TableHead>
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={admin.avatar_url || undefined} />
                        <AvatarFallback>
                          {(admin.full_name || admin.email).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium flex items-center gap-1">
                          {admin.full_name || "Unnamed"}
                          {admin.is_current_user && (
                            <Badge variant="outline" className="text-xs ml-1">
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{admin.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={admin.permissions.includes("admin_management") ? "default" : "secondary"}
                    >
                      {admin.permissions.includes("admin_management") ? (
                        <>
                          <ShieldCheck className="h-3 w-3 mr-1" /> {getAdminType(admin)}
                        </>
                      ) : (
                        <>
                          <Shield className="h-3 w-3 mr-1" /> {getAdminType(admin)}
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {admin.permissions.length === ALL_ADMIN_PERMISSIONS.length ? (
                        <Badge variant="outline" className="text-xs">
                          All Permissions
                        </Badge>
                      ) : admin.permissions.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        admin.permissions.slice(0, 3).map((p) => (
                          <Badge key={p} variant="outline" className="text-xs">
                            {ALL_ADMIN_PERMISSIONS.find((ap) => ap.key === p)?.label || p}
                          </Badge>
                        ))
                      )}
                      {admin.permissions.length > 3 &&
                        admin.permissions.length < ALL_ADMIN_PERMISSIONS.length && (
                          <Badge variant="outline" className="text-xs">
                            +{admin.permissions.length - 3} more
                          </Badge>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(admin.created_at).toLocaleDateString()}
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell className="text-right">
                      {!admin.is_current_user && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingAdmin(admin);
                              setEditPermissions([...admin.permissions]);
                            }}
                            title="Edit permissions"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(admin)}
                            title="Remove admin"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {admins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No admin accounts found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Presets Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Permission Presets</CardTitle>
          <CardDescription>Quick reference for common admin role configurations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PERMISSION_PRESETS.map((preset) => (
              <div key={preset.name} className="border rounded-lg p-3 space-y-2">
                <h4 className="font-medium text-sm">{preset.name}</h4>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
                <div className="flex flex-wrap gap-1">
                  {preset.permissions.length === ALL_ADMIN_PERMISSIONS.length ? (
                    <Badge variant="outline" className="text-xs">
                      All
                    </Badge>
                  ) : (
                    preset.permissions.map((p) => (
                      <Badge key={p} variant="outline" className="text-xs">
                        {ALL_ADMIN_PERMISSIONS.find((ap) => ap.key === p)?.label || p}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Admin Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Admin Account</DialogTitle>
            <DialogDescription>
              Create a new admin account and assign permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Admin name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="admin@zentragig.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <PermissionCheckboxes perms={newPermissions} setPerms={setNewPermissions} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!editingAdmin} onOpenChange={() => setEditingAdmin(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Permissions</DialogTitle>
            <DialogDescription>
              Update permissions for {editingAdmin?.full_name || editingAdmin?.email}
            </DialogDescription>
          </DialogHeader>
          <PermissionCheckboxes perms={editPermissions} setPerms={setEditPermissions} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAdmin(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePermissions} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
