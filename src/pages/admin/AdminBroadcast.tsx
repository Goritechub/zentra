import { BroadcastNotificationCard } from "@/components/admin/BroadcastNotificationCard";

export default function AdminBroadcast() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Broadcast Notifications</h1>
        <p className="text-muted-foreground text-sm mt-1">Send platform-wide announcements to all users</p>
      </div>
      <BroadcastNotificationCard />
    </div>
  );
}
