"use client";

import { useId } from "react";

/**
 * Fond à motif SVG : dalle unie bleu nuit + trame géométrique indigo.
 * Remplace les dégradés de couverture (aucun dégradé de couleur).
 */
export default function PatternCover({ className = "" }: { className?: string }) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const patternId = `lora-pattern-${rawId}`;

  return (
    <svg
      className={`block h-full w-full bg-[#171e3a] ${className}`}
      aria-hidden
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id={patternId} width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M0 32 32 0" stroke="rgb(129 140 248 / 0.14)" strokeWidth="1" />
          <path d="M-8 8 8 -8" stroke="rgb(129 140 248 / 0.08)" strokeWidth="1" />
          <path d="M24 40 40 24" stroke="rgb(129 140 248 / 0.08)" strokeWidth="1" />
          <circle cx="16" cy="16" r="1.2" fill="rgb(165 180 252 / 0.28)" />
          <circle cx="0" cy="0" r="1.2" fill="rgb(165 180 252 / 0.28)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
