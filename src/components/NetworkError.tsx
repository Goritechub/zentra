import { WifiOff, RefreshCw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { classifyError, type ErrorKind } from "@/lib/error-utils";

const ConnectionProblemIllustration = () => (
  <svg
    viewBox="0 0 480 320"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full max-w-xs mx-auto"
    aria-hidden="true"
  >
    {/* Background blobs — matches NotFoundIllustration */}
    <ellipse cx="100" cy="260" rx="80" ry="40" fill="hsl(var(--primary)/0.06)" />
    <ellipse cx="380" cy="80" rx="60" ry="30" fill="hsl(var(--primary)/0.06)" />

    {/* Large watermark text */}
    <text
      x="50%"
      y="60%"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize="72"
      fontWeight="800"
      fontFamily="ui-monospace,monospace"
      fill="hsl(var(--primary)/0.08)"
      letterSpacing="2"
    >
      OFFLINE
    </text>

    {/* Wifi arcs */}
    <path d="M 124 248 A 116 116 0 0 1 356 248" stroke="hsl(var(--primary)/0.35)" strokeWidth="14" strokeLinecap="round" />
    <path d="M 162 248 A 78 78 0 0 1 318 248" stroke="hsl(var(--primary)/0.55)" strokeWidth="14" strokeLinecap="round" />
    <path d="M 200 248 A 40 40 0 0 1 280 248" stroke="hsl(var(--primary))" strokeWidth="14" strokeLinecap="round" />
    <circle cx="240" cy="248" r="11" fill="hsl(var(--primary))" />

    {/* Cancel slash */}
    <line x1="172" y1="164" x2="308" y2="284" stroke="hsl(var(--destructive))" strokeWidth="16" strokeLinecap="round" />

    {/* Floating dots — matches NotFoundIllustration */}
    <circle cx="108" cy="108" r="8" fill="hsl(var(--primary)/0.4)" />
    <circle cx="88" cy="140" r="5" fill="hsl(var(--primary)/0.2)" />
    <circle cx="372" cy="200" r="10" fill="hsl(var(--primary)/0.3)" />
    <circle cx="396" cy="228" r="5" fill="hsl(var(--primary)/0.15)" />
    <circle cx="148" cy="272" r="6" fill="hsl(var(--primary)/0.2)" />
    <circle cx="344" cy="104" r="7" fill="hsl(var(--primary)/0.25)" />
  </svg>
);

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
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function NetworkError({ error, title: titleOverride, message, onRetry, className = "", compact = false }: NetworkErrorProps) {
  const kind = classifyError(error);
  const { title: defaultTitle, description } = MESSAGES[kind];
  const title = titleOverride || defaultTitle;
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
      {kind === "network" ? (
        <ConnectionProblemIllustration />
      ) : (
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-destructive" />
        </div>
      )}
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
