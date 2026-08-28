'use client';

import { useRef, useState } from 'react';

import { clamp01, fmtCompactMoney, fmtMoney } from './utils';

export default function PortfolioCurveChart({
  points,
  unit,
  height = 240,
}: {
  points: { date: string; cumulative: number }[];
  /** Currency or basis the cumulative figures are stated in. */
  unit?: string;
  height?: number;
}) {
  // The plot stretches to whatever width it is given, so the drawing lives in a
  // unit-ish viewBox with `preserveAspectRatio="none"`. Strokes opt out of that
  // scaling, and the y-axis labels sit in their own HTML column rather than inside
  // the svg, where they would stretch with it.
  const width = 1000;
  const padY = 14;
  const innerH = height - padY * 2;

  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (!points.length) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">
        No performance data yet.
      </div>
    );
  }

  const values = points.map((p) => p.cumulative);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const xFor = (i: number) => (points.length === 1 ? width / 2 : (i / (points.length - 1)) * width);
  const yFor = (v: number) => padY + ((max - v) / range) * innerH;
  const baseY = yFor(0);

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(2)} ${yFor(p.cumulative).toFixed(2)}`)
    .join(' ');
  const area = `${line} L ${xFor(points.length - 1).toFixed(2)} ${baseY.toFixed(2)} L ${xFor(0).toFixed(2)} ${baseY.toFixed(2)} Z`;

  const ticks = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4);

  const lastIndex = points.length - 1;
  const lastX = xFor(lastIndex);
  const lastY = yFor(points[lastIndex].cumulative);
  // The curve reads as the outcome it ended on, not as a fixed brand colour.
  const stroke = points[lastIndex].cumulative < 0 ? 'var(--curve-loss)' : 'var(--curve-gain)';

  const track = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const idx = Math.round(clamp01((clientX - rect.left) / rect.width) * (points.length - 1));
    const p = points[idx];
    if (!p) return;
    setHover({
      x: (xFor(idx) / width) * rect.width,
      y: (yFor(p.cumulative) / height) * rect.height,
      label: `${p.date} · ${fmtMoney(p.cumulative)}${unit ? ` ${unit}` : ''}`,
    });
  };

  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1" onMouseLeave={() => setHover(null)} onPointerMove={(e) => track(e.clientX)}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height }}
        >
          <defs>
            <linearGradient id="pnl-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {ticks.map((t, i) => (
            <line
              key={`grid-${i}`}
              x1={0}
              y1={yFor(t)}
              x2={width}
              y2={yFor(t)}
              stroke="var(--border)"
              strokeOpacity="0.5"
              strokeDasharray="6 6"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={area} fill="url(#pnl-area)" stroke="none" />
          <path d={line} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />

          <line
            x1={0}
            y1={baseY}
            x2={width}
            y2={baseY}
            stroke="var(--muted-foreground)"
            strokeOpacity="0.35"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Crosshair and marker are HTML so the stretched viewBox cannot squash them. */}
        {hover && (
          <span
            className="pointer-events-none absolute inset-y-0 w-px bg-muted-foreground/40"
            style={{ left: hover.x }}
          />
        )}

        <span
          className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-3"
          style={{
            left: `${(lastX / width) * 100}%`,
            top: `${(lastY / height) * 100}%`,
            background: stroke,
            // @ts-expect-error -- ring colour is a plain custom property on the element
            '--tw-ring-color': 'var(--background)',
          }}
        />

        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-background px-2 py-1 text-xs whitespace-nowrap shadow"
            style={{ left: hover.x, top: hover.y }}
          >
            {hover.label}
          </div>
        )}
      </div>

      <div className="relative w-12 shrink-0 sm:w-14" style={{ height }}>
        {ticks.map((t, i) => (
          <span
            key={`tick-${i}`}
            className="absolute right-0 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
            style={{ top: `${(yFor(t) / height) * 100}%` }}
          >
            {fmtCompactMoney(t)}
          </span>
        ))}
      </div>
    </div>
  );
}
