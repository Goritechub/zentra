import { WifiOff, RefreshCw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";

type ErrorKind = "network" | "server" | "not_found" | "unauthorized";

function detectKind(error?: Error | null): ErrorKind {
  if (!error) return "network";
  const msg = error.message.toLowerCase();
  if (msg.includes("network") || msg.includes("failed to fetch") || msg.includes("connection")) return "network";
  if (msg.includes("unauthorized") || msg.includes("401")) return "unauthorized";
  if (msg.includes("not found") || msg.includes("404")) return "not_found";
  return "server";
}

const MESSAGES: Record<ErrorKind, { title: string; description: string }> = {
  network: {
    title: "Connection problem",
    description: "Check your internet connection and try again.",
  },
  server: {
    title: "Something went wrong",
    description: "We're having trouble reaching our servers. Please try again.",
  },
  not_found: {
    title: "Not found",
    description: "This resource doesn't exist or may have been removed.",
  },
  unauthorized: {
    title: "Session expired",
    description: "Your session has expired. Please reload the page.",
  },
};

interface NetworkErrorProps {
  error?: Error | null;
  message?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function NetworkError({ error, message, onRetry, className = "", compact = false }: NetworkErrorProps) {
  const kind = detectKind(error);
  const { title, description } = MESSAGES[kind];
  const Icon = kind === "network" ? WifiOff : ServerCrash;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm ${className}`}>
        <Icon className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-destructive font-medium flex-1">{message || description}</span>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive">
            <RefreshCw className="h-3 w-3" /> Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-10 text-center ${className}`}>
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <Icon className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{message || description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}
