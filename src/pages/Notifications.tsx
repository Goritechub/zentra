import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNotificationUrl } from "@/lib/notifications";

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide max-w-3xl">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                Mark all as read
              </Button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.is_read) markAsRead(n.id);
                    const url = getNotificationUrl(n);
                    if (url) navigate(url);
                  }}
                  className={cn(
                    "w-full text-left bg-card rounded-xl border border-border p-4 hover:border-primary transition-colors",
                    !n.is_read && "border-primary/30 bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                     {!n.is_read && (
                       <span className="relative flex h-3 w-3 shrink-0 mt-1.5">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                         <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                       </span>
                     )}
                     <div className="flex-1">
                       <div className="flex items-center gap-2">
                         <p className="font-semibold text-foreground">{n.title}</p>
                         {!n.is_read && <Badge variant="default" className="text-xs px-1.5 py-0">New</Badge>}
                       </div>
                      <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
