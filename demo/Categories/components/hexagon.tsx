"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface HexagonProps {
  href: string;
  imageUrl?: string | null;
  label: string;
  sublabel?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
}

const sizeClasses = {
  sm: "w-24 h-28 md:w-28 md:h-32",
  md: "w-32 h-36 md:w-40 md:h-44",
  lg: "w-40 h-44 md:w-48 md:h-52",
};

export function Hexagon({
  href,
  imageUrl,
  label,
  sublabel,
  className,
  size = "md",
  priority = false,
}: HexagonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <Link
      href={href}
      className={cn(
        "group relative block transition-all duration-500 ease-out",
        sizeClasses[size],
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect */}
      <div
        className={cn(
          "absolute inset-0 clip-hexagon transition-all duration-500",
          "bg-gradient-to-br from-primary/40 to-accent/40",
          "blur-xl scale-110 opacity-0",
          isHovered && "opacity-70"
        )}
      />

      {/* Main hexagon container */}
      <div
        className={cn(
          "relative w-full h-full clip-hexagon overflow-hidden",
          "transition-all duration-500 ease-out",
          "bg-secondary",
          isHovered && "scale-105"
        )}
      >
        {/* Background image */}
        {imageUrl && !imageError ? (
          <Image
            src={imageUrl}
            alt={label}
            fill
            className={cn(
              "object-cover transition-all duration-500",
              isHovered ? "grayscale-0 scale-110" : "grayscale-[70%] scale-100"
            )}
            sizes="(max-width: 768px) 128px, 192px"
            priority={priority}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-secondary to-muted" />
        )}

        {/* Overlay gradient */}
        <div
          className={cn(
            "absolute inset-0 transition-all duration-500",
            "bg-gradient-to-t from-background/90 via-background/40 to-transparent",
            isHovered && "from-background/70 via-background/20"
          )}
        />

        {/* Golden border on hover */}
        <div
          className={cn(
            "absolute inset-0 clip-hexagon transition-all duration-500",
            "ring-2 ring-inset",
            isHovered ? "ring-primary/80" : "ring-border/50"
          )}
        />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-end p-3 pb-4">
          <span
            className={cn(
              "font-serif text-center text-sm md:text-base font-semibold leading-tight transition-all duration-300",
              "text-balance",
              isHovered ? "text-primary" : "text-foreground"
            )}
          >
            {label}
          </span>
          {sublabel && (
            <span
              className={cn(
                "text-xs text-center mt-0.5 transition-all duration-300",
                isHovered ? "text-foreground/90" : "text-muted-foreground"
              )}
            >
              {sublabel}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
