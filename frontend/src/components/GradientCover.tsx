"use client";

import { initialsOf } from "./cover";

/**
 * Couverture à dégradé sobre et professionnel, déterministe par titre :
 * chaque formation varie subtilement dans la gamme de la marque
 * (indigo → violet, 8 duotones proches), avec halos discrets.
 */
const PALETTES: Array<[string, string]> = [
  ["#4f46e5", "#7c3aed"], // indigo → violet
  ["#4338ca", "#6d28d9"], // indigo profond → violet profond
  ["#6366f1", "#8b5cf6"], // indigo clair → violet clair
  ["#3730a3", "#5b21b6"], // indigo nuit → violet nuit
  ["#4f46e5", "#818cf8"], // indigo → indigo clair
  ["#7c3aed", "#4f46e5"], // violet → indigo
  ["#312e81", "#4f46e5"], // bleu nuit → indigo
  ["#8b5cf6", "#6366f1"], // violet → indigo clair
];

export default function GradientCover({
  title,
  className = "",
  showInitials = true,
}: {
  title: string;
  className?: string;
  showInitials?: boolean;
}) {
  const hash = [...title].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const [c1, c2] = PALETTES[hash % PALETTES.length];
  const angle = 100 + (hash % 5) * 35; // 100° → 240°
  const glowX = 20 + (hash % 6) * 12; // 20 % → 80 %

  return (
    <div
      aria-hidden
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ background: `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 100%)` }}
    >
      {/* Halos de lumière pour la profondeur */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at ${glowX}% 12%, rgba(255,255,255,0.35), transparent 55%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 85% 95%, rgba(0,0,0,0.28), transparent 55%)",
        }}
      />
      {/* Filigrane des initiales */}
      {showInitials && (
        <span className="absolute -right-2 -top-4 select-none text-[5.5rem] font-black leading-none text-white/15">
          {initialsOf(title)}
        </span>
      )}
    </div>
  );
}
