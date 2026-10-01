"use client";

/**
 * Graphique en barres SVG maison — aucune dépendance.
 */
export default function BarChart({
  data,
  height = 180,
  format = (v: number) => String(v),
  color = "#6366f1",
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  format?: (v: number) => string;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 36;
  const gap = 18;
  const padX = 10;
  const padBottom = 26;
  const width = padX * 2 + data.length * barW + (data.length - 1) * gap;
  const plotH = height - padBottom;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img">
        {/* ligne de base */}
        <line
          x1={0}
          y1={plotH}
          x2={width}
          y2={plotH}
          className="stroke-line"
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const h = (d.value / max) * (plotH - 8);
          const x = padX + i * (barW + gap);
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={plotH - h}
                width={barW}
                height={Math.max(h, 2)}
                rx={6}
                fill={color}
                opacity={0.85}
              />
              <text
                x={x + barW / 2}
                y={plotH - h - 6}
                textAnchor="middle"
                className="fill-fg text-[11px] font-semibold"
              >
                {d.value > 0 ? format(d.value) : ""}
              </text>
              <text
                x={x + barW / 2}
                y={plotH + 16}
                textAnchor="middle"
                className="fill-muted text-[11px]"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
