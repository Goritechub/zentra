import { cn } from "@/lib/utils";

interface Props {
  status: string;
  className?: string;
}

const PILL_CONFIGS: Record<string, { bg: string; text: string; label: string }> = {
  completed:         { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", label: "Completed" },
  in_progress:       { bg: "bg-blue-500/10",    text: "text-blue-600 dark:text-blue-400",       label: "In Progress" },
  selecting_winners: { bg: "bg-violet-500/10",  text: "text-violet-600 dark:text-violet-400",   label: "Selecting Winners" },
  cancelled:         { bg: "bg-rose-500/10",    text: "text-rose-600 dark:text-rose-400",       label: "Cancelled" },
  rejected:          { bg: "bg-rose-500/10",    text: "text-rose-600 dark:text-rose-400",       label: "Rejected" },
  disputed:          { bg: "bg-orange-500/10",  text: "text-orange-600 dark:text-orange-400",   label: "Disputed" },
  draft:             { bg: "bg-muted",          text: "text-muted-foreground",                  label: "Draft" },
  closed:            { bg: "bg-muted",          text: "text-muted-foreground",                  label: "Closed" },
  pending:           { bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-400",     label: "Pending" },
};

export function StatusBadge({ status, className }: Props) {
  const s = status?.toLowerCase();

  if (s === "active" || s === "open") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400", className)}>
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
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
