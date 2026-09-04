import { cn } from "@/lib/utils";

interface Props {
  status: string;
  className?: string;
}

const PILL_CONFIGS: Record<string, { bg: string; text: string; label: string }> = {
  completed:         { bg: "bg-success/10", text: "text-success", label: "Completed" },
  in_progress:       { bg: "bg-info/10",    text: "text-info",    label: "In Progress" },
  selecting_winners: { bg: "bg-misc/10",    text: "text-misc",    label: "Selecting Winners" },
  cancelled:         { bg: "bg-error/10",   text: "text-error",   label: "Cancelled" },
  rejected:          { bg: "bg-error/10",   text: "text-error",   label: "Rejected" },
  disputed:          { bg: "bg-warning/10", text: "text-warning", label: "Disputed" },
  draft:             { bg: "bg-muted",      text: "text-muted-foreground", label: "Draft" },
  closed:            { bg: "bg-muted",      text: "text-muted-foreground", label: "Closed" },
  pending:           { bg: "bg-warning/10", text: "text-warning", label: "Pending" },
};

export function StatusBadge({ status, className }: Props) {
  const s = status?.toLowerCase();

  if (s === "active" || s === "open") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-success", className)}>
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
        </span>
        {s === "open" ? "Open" : "Active"}
      </span>
    );
  }

  const config = PILL_CONFIGS[s];
  if (config) {
    return (
      <span className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.bg, config.text, className,
      )}>
        {config.label}
      </span>
    );
  }

  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground",
      className,
    )}>
      {s?.replace(/_/g, " ")}
    </span>
  );
}
