import logoIcon from "@/assets/zentragig-logo.png";

interface ZentraGigLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { circle: "h-9 w-9", icon: "h-11 w-11", text: "text-lg" },
  md: { circle: "h-10 w-10", icon: "h-12 w-12", text: "text-xl" },
  lg: { circle: "h-12 w-12", icon: "h-14 w-14", text: "text-2xl" },
};

export function ZentraGigLogo({ size = "md", showText = true, className = "" }: ZentraGigLogoProps) {
  const s = sizeMap[size];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`${s.circle} rounded-full flex items-center justify-center shrink-0 bg-primary overflow-hidden`}>
        <img src={logoIcon} alt="ZentraGig" className="h-full w-full object-cover scale-125" />
      </span>
      {showText && (
        <span className={`${s.text} font-bold`} style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          <span className="text-foreground">Zentra</span>
          <span className="text-primary">Gig</span>
        </span>
      )}
    </span>
  );
}
