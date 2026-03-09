import { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, ShieldAlert, LayoutDashboard, Users, Briefcase, FileText,
  Wallet, Gavel, Star, Settings, Activity, ChevronLeft, ChevronRight,
  LogOut, Trophy, UserCog, ShieldCheck, Headphones, ThumbsUp, Scale, Palette } from
"lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useColorTheme, THEME_OPTIONS } from "@/hooks/useTheme";

const allNavItems = [
{ label: "Overview", icon: LayoutDashboard, path: "/admin", permission: null as string | null },
{ label: "Users", icon: Users, path: "/admin/users", permission: "users" },
{ label: "Jobs", icon: Briefcase, path: "/admin/jobs", permission: "jobs" },
{ label: "Contests", icon: Trophy, path: "/admin/contests", permission: "contests" },
{ label: "Contracts", icon: FileText, path: "/admin/contracts", permission: "contracts" },
{ label: "Payments", icon: Wallet, path: "/admin/payments", permission: "payments" },
{ label: "Disputes", icon: Gavel, path: "/admin/disputes", permission: "disputes" },
{ label: "Reviews", icon: Star, path: "/admin/reviews", permission: "reviews" },
{ label: "Settings", icon: Settings, path: "/admin/settings", permission: "platform_settings" },
{ label: "Verification", icon: ShieldCheck, path: "/admin/verification", permission: "users" },
{ label: "Support", icon: Headphones, path: "/admin/support", permission: "platform_settings" },
{ label: "Platform Reviews", icon: ThumbsUp, path: "/admin/platform-reviews", permission: "reviews" },
{ label: "Activity Log", icon: Activity, path: "/admin/activity", permission: "activity_log" },
{ label: "Admin Management", icon: UserCog, path: "/admin/management", permission: "admin_management" },
{ label: "Legal Documents", icon: Scale, path: "/admin/legal-documents", permission: "platform_settings" }];


export default function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const { colorTheme, setColorTheme } = useColorTheme();

  useEffect(() => {
    if (!authLoading && user) checkAdmin();
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  const checkAdmin = async () => {
    const { data } = await supabase.
    from("user_roles").
    select("role").
    eq("user_id", user!.id).
    eq("role", "admin").
    maybeSingle();

    if (!data) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    // Fetch this admin's permissions
    const { data: perms } = await supabase.
    from("admin_permissions" as any).
    select("permission").
    eq("user_id", user!.id);

    if (!perms || perms.length === 0) {
      // Check if ANY permissions exist globally
      const { count } = await supabase.
      from("admin_permissions" as any).
      select("id", { count: "exact", head: true });

      if (count === 0) {
        // First admin ever — bootstrap as super admin
        try {
          const { data: bootstrapData } = await supabase.functions.invoke("manage-admin", {
            body: { action: "bootstrap" }
          });
          if (bootstrapData?.permissions) {
            setPermissions(bootstrapData.permissions);
          }
        } catch (err) {
          console.error("Bootstrap failed:", err);
        }
      }
    } else {
      setPermissions(perms.map((p: any) => p.permission));
    }

    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>);

  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have admin privileges.</p>
          <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>);

  }

  // Filter nav items by permissions
  const navItems = allNavItems.filter(
    (item) => !item.permission || permissions.includes(item.permission)
  );

  // Block access to pages the admin doesn't have permission for
  const currentNavItem = allNavItems.find((item) => {
    if (item.path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(item.path);
  });

  if (currentNavItem?.permission && !permissions.includes(currentNavItem.permission)) {
    return <Navigate to="/admin" replace />;
  }

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-sidebar text-sidebar-foreground z-40 flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}>
        
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
          {!collapsed &&
          <div className="flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-sidebar-primary" />
              <span className="font-bold text-lg">ZentraGig Admin</span>
            </div>
          }
          {collapsed && <ShieldAlert className="h-6 w-6 text-sidebar-primary mx-auto" />}
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {navItems.map((item) =>
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive(item.path) ?
                "bg-sidebar-accent text-sidebar-accent-foreground" :
                "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}>
              
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            )}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="p-2 border-t border-sidebar-border space-y-1">
          {/* Theme Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors">
                <Palette className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Theme</span>}
                {!collapsed && (
                  <span
                    className="ml-auto h-4 w-4 rounded-full border border-sidebar-border shrink-0"
                    style={{ backgroundColor: THEME_OPTIONS.find(t => t.value === colorTheme)?.color }}
                  />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" className="w-44 p-2">
              <p className="text-xs font-medium text-muted-foreground px-2 pb-1">Select Theme</p>
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setColorTheme(t.value)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                    colorTheme === t.value ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                  )}
                >
                  <span className="h-3.5 w-3.5 rounded-full shrink-0 border border-border" style={{ backgroundColor: t.color }} />
                  {t.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Logged out successfully");
              navigate("/auth");
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors">
            
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Admin Logout</span>}
          </button>
          <button onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
            
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "ml-16" : "ml-64"
        )}>
        
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet context={{ permissions }} />
        </div>
      </main>
    </div>);

}