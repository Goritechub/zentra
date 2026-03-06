import logoIcon from "@/assets/zentragig-logo.png";

interface ZentraGigLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { circle: "h-8 w-8", icon: "h-6 w-6", text: "text-lg" },
  md: { circle: "h-9 w-9", icon: "h-[28px] w-[28px]", text: "text-xl" },
  lg: { circle: "h-10 w-10", icon: "h-8 w-8", text: "text-2xl" },
};

export function ZentraGigLogo({ size = "md", showText = true, className = "" }: ZentraGigLogoProps) {
  const s = sizeMap[size];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`${s.circle} rounded-full flex items-center justify-center shrink-0 bg-primary dark:bg-primary`}>
        <img src={logoIcon} alt="ZentraGig" className={`${s.icon} object-contain`} />
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
