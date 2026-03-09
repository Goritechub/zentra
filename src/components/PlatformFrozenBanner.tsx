import { usePlatformFreeze } from "@/hooks/usePlatformFreeze";
import { ShieldAlert } from "lucide-react";

export function PlatformFrozenBanner() {
  const { platformFrozen, freezeMessage } = usePlatformFreeze();

  if (!platformFrozen) return null;

  return (
    <div className="bg-destructive text-destructive-foreground px-4 py-3 text-center text-sm font-medium flex items-center justify-center gap-2">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span>{freezeMessage || "The platform is temporarily under maintenance."}</span>
    </div>
  );
}
