"use client";

export type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

/**
 * Diagramme circulaire (donut) en SVG pur — aucune dépendance.
 * Texte central superposé (taille auto-ajustée pour tenir dans l'anneau)
 * + légende à droite avec points colorés.
 */
export default function Donut({
  segments,
  size = 118,
  thickness = 16,
  centerLabel,
  centerSub,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string | number;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;

  const label = centerLabel !== undefined ? String(centerLabel) : String(total);
  // Auto-ajustement : la police rétrécit quand le libellé est long ou le
  // donut petit, pour ne jamais déborder sur l'anneau.
  const rInner = r - thickness / 2;
  const usableWidth = 1.5 * rInner; // corde praticable au centre du cercle
  const centerFontSize = Math.max(
    9,
    Math.min(size * 0.22, (usableWidth * 1.8) / Math.max(label.length, 1))
  );
  const subFontSize = Math.max(8, Math.min(11, size * 0.09));

  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
        >
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            strokeWidth={thickness}
            className="stroke-surface-2"
          />
          {total > 0 &&
            segments
              .filter((s) => s.value > 0)
              .map((s) => {
                const len = (s.value / total) * c;
                const dash = `${len} ${c - len}`;
                const el = (
                  <circle
                    key={s.label}
                    cx={cx}
                    cy={cx}
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={thickness}
                    strokeDasharray={dash}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return el;
              })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
          <span
            className="font-bold leading-none text-fg tabular-nums"
            style={{ fontSize: `${centerFontSize}px` }}
          >
            {label}
          </span>
          {centerSub && (
            <span
              className="mt-0.5 font-medium leading-tight text-muted"
              style={{ fontSize: `${subFontSize}px` }}
            >
              {centerSub}
            </span>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs sm:text-sm">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="truncate text-fg-soft">{s.label}</span>
            <span className="ml-auto pl-2 font-semibold text-fg">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
