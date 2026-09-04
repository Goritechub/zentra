import type { ReactNode } from "react";
import {
  Search,
  Bookmark,
  FileText,
  Users,
  MessageSquare,
  Trophy,
  Wallet,
  Bell,
  Image as ImageIcon,
  ShieldCheck,
} from "lucide-react";

export type EmptyStateVariant =
  | "search"
  | "bookmark"
  | "documents"
  | "people"
  | "chat"
  | "trophy"
  | "wallet"
  | "bell"
  | "image"
  | "shield";

const DOTS = [
  { cx: 108, cy: 108, r: 8, o: 0.4 },
  { cx: 88, cy: 140, r: 5, o: 0.2 },
  { cx: 372, cy: 200, r: 10, o: 0.3 },
  { cx: 396, cy: 228, r: 5, o: 0.15 },
  { cx: 148, cy: 272, r: 6, o: 0.2 },
  { cx: 344, cy: 104, r: 7, o: 0.25 },
] as const;

function IllustrationFrame({
  watermark,
  fontSize,
  children,
}: {
  watermark: string;
  fontSize: number;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 480 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[200px] mx-auto"
      aria-hidden="true"
    >
      <ellipse
        cx="100"
        cy="260"
        rx="80"
        ry="40"
        fill="hsl(var(--primary)/0.06)"
      />
      <ellipse
        cx="380"
        cy="80"
        rx="60"
        ry="30"
        fill="hsl(var(--primary)/0.06)"
      />

      {/* <text
        x="50%"
        y="58%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight="800"
        fontFamily="ui-monospace,monospace"
        fill="hsl(var(--primary)/0.08)"
        letterSpacing="2"
      >
        {watermark}
      </text> */}

      {children}

      {DOTS.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.r}
          fill={`hsl(var(--primary)/${d.o})`}
        />
      ))}
    </svg>
  );
}

const SearchIllustration = () => (
  <IllustrationFrame watermark="EMPTY" fontSize={90}>
    <circle
      cx="228"
      cy="148"
      r="72"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      fill="hsl(var(--card))"
    />
    <line
      x1="278"
      y1="198"
      x2="322"
      y2="242"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      strokeLinecap="round"
    />
  </IllustrationFrame>
);

const BookmarkIllustration = () => (
  <IllustrationFrame watermark="SAVED" fontSize={90}>
    <path
      d="M195,75 H285 V245 L240,208 L195,245 Z"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      strokeLinejoin="round"
      fill="hsl(var(--card))"
    />
  </IllustrationFrame>
);

const DocumentsIllustration = () => (
  <IllustrationFrame watermark="EMPTY" fontSize={90}>
    <rect
      x="196"
      y="76"
      width="110"
      height="140"
      rx="10"
      fill="hsl(var(--card))"
      stroke="hsl(var(--primary)/0.35)"
      strokeWidth="8"
    />
    <rect
      x="168"
      y="96"
      width="140"
      height="170"
      rx="12"
      fill="hsl(var(--card))"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
    />
    <polygon
      points="272,96 308,96 308,132"
      fill="hsl(var(--primary)/0.15)"
      stroke="hsl(var(--primary))"
      strokeWidth="8"
      strokeLinejoin="round"
    />
    <line
      x1="192"
      y1="196"
      x2="284"
      y2="196"
      stroke="hsl(var(--primary)/0.35)"
      strokeWidth="8"
      strokeLinecap="round"
    />
    <line
      x1="192"
      y1="222"
      x2="284"
      y2="222"
      stroke="hsl(var(--primary)/0.35)"
      strokeWidth="8"
      strokeLinecap="round"
    />
    <line
      x1="192"
      y1="248"
      x2="252"
      y2="248"
      stroke="hsl(var(--primary)/0.35)"
      strokeWidth="8"
      strokeLinecap="round"
    />
  </IllustrationFrame>
);

const PeopleIllustration = () => (
  <IllustrationFrame watermark="NONE" fontSize={110}>
    <circle
      cx="192"
      cy="112"
      r="22"
      stroke="hsl(var(--primary)/0.4)"
      strokeWidth="10"
      fill="hsl(var(--card))"
    />
    <path
      d="M148,222 a44,44 0 0 1 88,0"
      stroke="hsl(var(--primary)/0.4)"
      strokeWidth="10"
      fill="none"
      strokeLinecap="round"
    />
    <circle
      cx="256"
      cy="120"
      r="28"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      fill="hsl(var(--card))"
    />
    <path
      d="M200,244 a56,56 0 0 1 112,0"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      fill="none"
      strokeLinecap="round"
    />
  </IllustrationFrame>
);

const ChatIllustration = () => (
  <IllustrationFrame watermark="QUIET" fontSize={90}>
    <rect
      x="150"
      y="80"
      width="180"
      height="120"
      rx="30"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      fill="hsl(var(--card))"
    />
    <polygon
      points="196,198 196,232 228,198"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      strokeLinejoin="round"
      fill="hsl(var(--card))"
    />
    <circle cx="205" cy="140" r="8" fill="hsl(var(--primary)/0.3)" />
    <circle cx="240" cy="140" r="8" fill="hsl(var(--primary)/0.3)" />
    <circle cx="275" cy="140" r="8" fill="hsl(var(--primary)/0.3)" />
  </IllustrationFrame>
);

const TrophyIllustration = () => (
  <IllustrationFrame watermark="SOON" fontSize={110}>
    <path
      d="M188,90 H292 L282,150 Q282,182 240,182 Q198,182 198,150 Z"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      strokeLinejoin="round"
      fill="hsl(var(--card))"
    />
    <path
      d="M188,102 Q158,102 158,132 Q158,154 190,154"
      stroke="hsl(var(--primary))"
      strokeWidth="10"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M292,102 Q322,102 322,132 Q322,154 290,154"
      stroke="hsl(var(--primary))"
      strokeWidth="10"
      fill="none"
      strokeLinecap="round"
    />
    <line
      x1="240"
      y1="182"
      x2="240"
      y2="218"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      strokeLinecap="round"
    />
    <line
      x1="206"
      y1="228"
      x2="274"
      y2="228"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      strokeLinecap="round"
    />
    <line
      x1="188"
      y1="248"
      x2="292"
      y2="248"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      strokeLinecap="round"
    />
  </IllustrationFrame>
);

const WalletIllustration = () => (
  <IllustrationFrame watermark="ZERO" fontSize={110}>
    <rect
      x="150"
      y="110"
      width="180"
      height="120"
      rx="18"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      fill="hsl(var(--card))"
    />
    <line
      x1="150"
      y1="152"
      x2="330"
      y2="152"
      stroke="hsl(var(--primary)/0.3)"
      strokeWidth="6"
    />
    <circle
      cx="290"
      cy="172"
      r="16"
      stroke="hsl(var(--primary))"
      strokeWidth="10"
      fill="hsl(var(--card))"
    />
  </IllustrationFrame>
);

const BellIllustration = () => (
  <IllustrationFrame watermark="QUIET" fontSize={90}>
    <path
      d="M240,92 C200,92 190,140 190,168 L190,198 L290,198 L290,168 C290,140 280,92 240,92 Z"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      strokeLinejoin="round"
      fill="hsl(var(--card))"
    />
    <circle cx="240" cy="82" r="10" fill="hsl(var(--primary))" />
    <line
      x1="180"
      y1="198"
      x2="300"
      y2="198"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      strokeLinecap="round"
    />
  </IllustrationFrame>
);

const ImageIllustration = () => (
  <IllustrationFrame watermark="BLANK" fontSize={90}>
    <rect
      x="150"
      y="90"
      width="180"
      height="140"
      rx="16"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      fill="hsl(var(--card))"
    />
    <circle
      cx="200"
      cy="140"
      r="16"
      stroke="hsl(var(--primary))"
      strokeWidth="10"
      fill="none"
    />
    <path
      d="M160,210 L220,150 L260,190 L300,140 L320,210 Z"
      fill="hsl(var(--primary)/0.15)"
      stroke="hsl(var(--primary))"
      strokeWidth="10"
      strokeLinejoin="round"
    />
  </IllustrationFrame>
);

const ShieldIllustration = () => (
  <IllustrationFrame watermark="CALM" fontSize={110}>
    <path
      d="M240,80 L310,110 V170 C310,215 280,245 240,260 C200,245 170,215 170,170 V110 Z"
      stroke="hsl(var(--primary))"
      strokeWidth="14"
      strokeLinejoin="round"
      fill="hsl(var(--card))"
    />
    <path
      d="M208,168 L232,192 L274,142"
      stroke="hsl(var(--primary)/0.35)"
      strokeWidth="10"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IllustrationFrame>
);

const ILLUSTRATIONS: Record<EmptyStateVariant, () => JSX.Element> = {
  search: SearchIllustration,
  bookmark: BookmarkIllustration,
  documents: DocumentsIllustration,
  people: PeopleIllustration,
  chat: ChatIllustration,
  trophy: TrophyIllustration,
  wallet: WalletIllustration,
  bell: BellIllustration,
  image: ImageIllustration,
  shield: ShieldIllustration,
};

const COMPACT_ICONS: Record<EmptyStateVariant, typeof Search> = {
  search: Search,
  bookmark: Bookmark,
  documents: FileText,
  people: Users,
  chat: MessageSquare,
  trophy: Trophy,
  wallet: Wallet,
  bell: Bell,
  image: ImageIcon,
  shield: ShieldCheck,
};

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  variant,
  title,
  description,
  action,
  compact = false,
  className = "",
}: EmptyStateProps) {
  if (compact) {
    const Icon = COMPACT_ICONS[variant];
    return (
      <div
        className={`flex flex-col items-center justify-center py-8 px-4 text-center text-muted-foreground ${className}`}
      >
        <Icon className="h-8 w-8 mb-3 opacity-40" />
        <p className="font-medium text-sm">{title}</p>
        {description && <p className="text-xs mt-1">{description}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    );
  }

  const Illustration = ILLUSTRATIONS[variant];

  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground ${className}`}
    >
      <Illustration />
      <p className="font-medium text-foreground mt-2">{title}</p>
      {description && <p className="text-sm mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
