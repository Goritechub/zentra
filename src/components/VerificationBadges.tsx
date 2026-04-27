import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Star, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationBadgesProps {
  isVerified: boolean;
  isZentraVerified: boolean;
  role?: "client" | "freelancer" | null;
  size?: "sm" | "md";
  className?: string;
}

export function VerificationBadges({ isVerified, isZentraVerified, role, size = "md", className }: VerificationBadgesProps) {
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showInfo) return;
    const handler = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setShowInfo(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showInfo]);

  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  const verifiedLabel =
    role === "client" ? "Verified Client" : role === "freelancer" ? "Verified Engineer" : "Verified User";

  const expertPaths = [
    "Complete a job successfully",
    "Win a contest",
    "Get approved by ZentraGig admin",
  ];
  const clientPaths = [
    "Complete a full job flow (post, hire & release payment)",
    "Host and complete a contest",
    "Get approved by ZentraGig admin",
  ];
  const paths = role === "client" ? clientPaths : expertPaths;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {isVerified && (
        <Badge variant="outline" className={cn("bg-primary/10 text-primary border-primary/20 gap-1", textSize)}>
          <CheckCircle2 className={iconSize} />
          {verifiedLabel}
        </Badge>
      )}
      <div className="relative inline-flex items-center gap-1" ref={infoRef}>
        <Badge
          variant="outline"
          className={cn(
            "gap-1",
            textSize,
            isZentraVerified
              ? "bg-accent/15 text-accent border-accent/25"
              : "bg-muted text-muted-foreground border-border/60"
          )}
        >
          <Star className={cn(iconSize, isZentraVerified ? "fill-accent" : "")} />
          ZentraGig Badge
        </Badge>
        {!isZentraVerified && (
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="How to get ZentraGig Badge"
          >
            <Info className={iconSize} />
          </button>
        )}
        {showInfo && (
          <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-border bg-popover shadow-xl p-4 z-50">
            <p className={cn("font-semibold text-foreground mb-2", textSize)}>How to get ZentraGig Badge</p>
            <ul className={cn("text-muted-foreground space-y-1.5", textSize)}>
              {paths.map((path) => (
                <li key={path} className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5 shrink-0">•</span>
                  {path}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
