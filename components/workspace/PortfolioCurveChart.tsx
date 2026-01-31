'use client';

import { useRef, useState } from 'react';

import { clamp01, fmtMoney } from './utils';

export default function PortfolioCurveChart({
  points,
  height = 260,
}: {
  points: { date: string; cumulative: number }[];
  height?: number;
}) {
  const width = 1000;
  const padX = 32;
  const padY = 24;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (!points.length) {
    return (
      <div className="h-[260px] rounded-xl border border-dashed bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">
        No performance data yet.
      </div>
    );
  }

  const values = points.map((p) => p.cumulative);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const xFor = (i: number) => (points.length === 1 ? width / 2 : padX + (i / (points.length - 1)) * innerW);
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

  return (
    <div
      className="relative"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const pct = clamp01((x - padX) / innerW);
        const idx = Math.round(pct * (points.length - 1));
        const p = points[idx];
        if (!p) return;
        const cx = xFor(idx);
        const cy = yFor(p.cumulative);
        setHover({
          x: (cx / width) * rect.width,
          y: (cy / height) * rect.height,
          label: `${p.date} · ${fmtMoney(p.cumulative)}`,
        });
      }}
      onPointerMove={(e) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const pct = clamp01((x - padX) / innerW);
        const idx = Math.round(pct * (points.length - 1));
        const p = points[idx];
        if (!p) return;
        const cx = xFor(idx);
        const cy = yFor(p.cumulative);
        setHover({
          x: (cx / width) * rect.width,
          y: (cy / height) * rect.height,
          label: `${p.date} · ${fmtMoney(p.cumulative)}`,
        });
      }}
    >
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-[260px]">
        <defs>
          <linearGradient id="pnl-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} rx="18" fill="transparent" />

        {ticks.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={`grid-${i}`}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="var(--border)" strokeOpacity="0.5" strokeDasharray="6 6" />
              <text x={width - padX + 6} y={y + 4} fontSize="12" fill="var(--muted-foreground)">
                {fmtMoney(t)}
              </text>
            </g>
          );
        })}

        <path d={area} fill="url(#pnl-area)" stroke="none" />
        <path d={line} fill="none" stroke="var(--chart-2)" strokeWidth="3" />

        <line x1={padX} y1={baseY} x2={width - padX} y2={baseY} stroke="var(--muted-foreground)" strokeOpacity="0.35" />

        <circle cx={lastX} cy={lastY} r="6" fill="var(--chart-2)" stroke="white" strokeWidth="2" />
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-background px-2 py-1 text-xs shadow"
          style={{ left: hover.x, top: hover.y }}
        >
          {hover.label}
        </div>
      )}
    </div>
  );
}
