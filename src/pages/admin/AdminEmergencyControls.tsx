import { PlatformFreezeCard } from "@/components/admin/PlatformFreezeCard";

export default function AdminEmergencyControls() {
  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Emergency Controls</h1>
      <PlatformFreezeCard />
    </div>
  );
}
