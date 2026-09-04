import logoNavy from "@/assets/zentragig-wordmark-navy.png";
import logoWhite from "@/assets/zentragig-wordmark-white.png";

interface ZentraGigLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "navy" | "white";
  className?: string;
}

const sizeMap = {
  sm: "h-6",
  md: "h-8",
  lg: "h-10",
};

export function ZentraGigLogo({ size = "md", variant = "navy", className = "" }: ZentraGigLogoProps) {
  const src = variant === "white" ? logoWhite : logoNavy;

  return (
    <img
      src={src}
      alt="ZentraGig"
      className={`${sizeMap[size]} w-auto object-contain ${className}`}
    />
  );
}
