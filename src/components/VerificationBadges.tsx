import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationBadgesProps {
  isVerified: boolean;
  isZentraVerified: boolean;
  role?: "client" | "freelancer" | string;
  size?: "sm" | "md";
  className?: string;
}

export function VerificationBadges({ isVerified, isZentraVerified, role, size = "md", className }: VerificationBadgesProps) {
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  const verifiedLabel = role === "client" ? "Verified Client" : "Verified Engineer";

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {isVerified && (
        <Badge variant="outline" className={cn("bg-primary/10 text-primary border-primary/20 gap-1", textSize)}>
          <CheckCircle2 className={iconSize} />
          {verifiedLabel}
        </Badge>
      )}
      {isZentraVerified && (
        <Badge variant="outline" className={cn("bg-accent/15 text-accent border-accent/25 gap-1", textSize)}>
          <Star className={cn(iconSize, "fill-accent")} />
          ZentraGig Verified
        </Badge>
      )}
    </div>
  );
}
