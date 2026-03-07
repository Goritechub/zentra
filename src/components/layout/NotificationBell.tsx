import { useNotifications, Notification } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.contract_id) navigate(`/contract/${n.contract_id}`);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && unreadCount > 0) {
      markAllAsRead();
    }
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
          ) : (
            <div className="divide-y divide-border">
              {notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                    !n.is_read && "bg-primary/5"
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2">
            <button
              onClick={() => navigate("/notifications")}
              className="text-xs text-primary hover:underline w-full text-center"
            >
              View all notifications
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
