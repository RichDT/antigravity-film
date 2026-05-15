"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  className?: string;
  iconClassName?: string;
  label?: string;
  title?: string;
}

export function BackButton({ className, iconClassName, label, title }: BackButtonProps) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className={className}
      title={title}
      aria-label={label ?? "Go back"}
    >
      <ChevronLeft className={iconClassName ?? "w-5 h-5"} />
      {label && <span>{label}</span>}
    </button>
  );
}
