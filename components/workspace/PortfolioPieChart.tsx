'use client';

import { useRef, useState } from 'react';

import Money from './Money';
import { fmtMoney, fmtPct } from './utils';

export default function PortfolioPieChart({
  items,
  size = 220,
  centerTitle = 'Total',
  centerValue,
  unit,
  legend = true,
}: {
  items: { label: string; value: number; color: string }[];
  size?: number;
  centerTitle?: string;
  /** Defaults to the charted total; pass a formatted figure to override it. */
  centerValue?: string;
  /** Currency the slice values are denominated in. */
  unit?: string;
  /** A ring is unreadable without one, so legends are on unless a list sits beside it. */
  legend?: boolean;
}) {
  const total = items.reduce((a, b) => a + b.value, 0);
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  if (!items.length || total <= 0) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">
        No allocation data.
      </div>
    );
  }

  // A ring drawn at 100% is a solid disc that says nothing the label does not — state
  // the single value instead of spending a whole card on it.
  if (items.length === 1) {
    const only = items[0];
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4">
        <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: only.color }} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{only.label}</div>
          <div className="text-xs text-muted-foreground">
            {centerTitle} · entirely {only.label}
          </div>
        </div>
        <div className="ml-auto shrink-0 text-sm font-semibold">
          <Money value={total} unit={unit} />
        </div>
      </div>
    );
  }

  const center = size / 2;
  const radius = size / 2 - 8;

  // Each slice starts where the shares before it left off, measured from twelve
  // o'clock — derived rather than accumulated so the geometry stays a pure function
  // of the items.
  const slices = items.map((it, idx) => {
    const before = items.slice(0, idx).reduce((acc, prev) => acc + prev.value, 0);
    const start = -Math.PI / 2 + (before / total) * Math.PI * 2;
    const angle = (it.value / total) * Math.PI * 2;
    const end = start + angle;
    const large = angle > Math.PI ? 1 : 0;
    const x1 = center + radius * Math.cos(start);
    const y1 = center + radius * Math.sin(start);
    const x2 = center + radius * Math.cos(end);
    const y2 = center + radius * Math.sin(end);
    const d = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
    const label = `${it.label} · ${fmtMoney(it.value)}${unit ? ` ${unit}` : ''}`;
    // A lone slice spans the full circle, where the arc's start and end points coincide
    // and the path renders as nothing — draw it as a circle instead.
    const full = angle >= Math.PI * 2 - 1e-6;
    return { d, full, color: it.color, start, end, label, idx };
  });

  /**
   * The svg is laid out `w-full` over a square viewBox, so it letterboxes: map the
   * pointer back through that fit before comparing it against viewBox radii, or the
   * hit test drifts with the container width.
   */
  const hitTest = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = Math.min(rect.width, rect.height) / size;
    const offsetX = (rect.width - size * scale) / 2;
    const offsetY = (rect.height - size * scale) / 2;
    const vx = (clientX - rect.left - offsetX) / scale - center;
    const vy = (clientY - rect.top - offsetY) / scale - center;

    const dist = Math.hypot(vx, vy);
    if (dist < radius * 0.55 || dist > radius) {
      setHover(null);
      return;
    }
    let angle = Math.atan2(vy, vx);
    if (angle < -Math.PI / 2) angle += Math.PI * 2;
    const hit = slices.find((sl) => angle >= sl.start && angle < sl.end);
    if (!hit) return;
    setHover({ x: clientX - rect.left, y: clientY - rect.top, label: hit.label });
  };

  return (
    <div
      className="relative"
      onMouseLeave={() => setHover(null)}
      onPointerMove={(e) => hitTest(e.clientX, e.clientY)}
    >
      <svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} className="h-[180px] w-full">
        {slices.map((s) =>
          s.full ? (
            <circle key={`slice-${s.idx}`} cx={center} cy={center} r={radius} fill={s.color} />
          ) : (
            <path key={`slice-${s.idx}`} d={s.d} fill={s.color} />
          )
        )}
        <circle cx={center} cy={center} r={radius * 0.55} fill="var(--background)" />
        <text x={center} y={unit ? center - 10 : center - 4} textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">
          {centerTitle}
        </text>
        <text
          x={center}
          y={unit ? center + 9 : center + 16}
          textAnchor="middle"
          fontSize="17"
          fill="var(--foreground)"
          fontWeight="600"
        >
          {centerValue ?? fmtMoney(total)}
        </text>
        {unit && (
          <text x={center} y={center + 25} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
            {unit}
          </text>
        )}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-background px-2 py-1 text-xs shadow"
          style={{ left: hover.x, top: hover.y }}
        >
          {hover.label}
        </div>
      )}
      {legend && (
        <div className="mt-3 space-y-1.5">
          {items.map((it) => (
            <div key={`legend-${it.label}`} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: it.color }} />
                <span className="truncate">{it.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{fmtPct(it.value / total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
