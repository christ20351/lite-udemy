"use client";

/** Couverture générée : dégradé déterministe à partir du titre. */
export function coverGradient(title: string) {
  const palettes = [
    "from-indigo-600 via-indigo-800 to-slate-950",
    "from-violet-600 via-purple-800 to-slate-950",
    "from-sky-500 via-blue-800 to-slate-950",
    "from-emerald-500 via-teal-800 to-slate-950",
    "from-amber-500 via-orange-800 to-slate-950",
    "from-rose-500 via-pink-800 to-slate-950",
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return palettes[hash % palettes.length];
}

export function initialsOf(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
