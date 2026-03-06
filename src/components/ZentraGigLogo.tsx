import logoIcon from "@/assets/zentragig-logo.png";

interface ZentraGigLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { icon: "h-8 w-8", text: "text-lg" },
  md: { icon: "h-9 w-9", text: "text-xl" },
  lg: { icon: "h-10 w-10", text: "text-2xl" },
};

export function ZentraGigLogo({ size = "md", showText = true, className = "" }: ZentraGigLogoProps) {
  const s = sizeMap[size];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src={logoIcon} alt="ZentraGig" className={`${s.icon} object-contain`} />
      {showText && (
        <span
          className={`${s.text} font-bold`}
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          <span className="text-foreground">Zentra</span>
          <span className="text-primary">Gig</span>
        </span>
      )}
    </span>
  );
}
