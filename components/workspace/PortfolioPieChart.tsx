'use client';

import { useRef, useState } from 'react';

import { fmtMoney } from './utils';

export default function PortfolioPieChart({
  items,
  size = 220,
  centerTitle = 'Allocation',
  centerValue,
}: {
  items: { label: string; value: number; color: string }[];
  size?: number;
  centerTitle?: string;
  /** Defaults to the slice count; pass a formatted total for value-based charts. */
  centerValue?: string;
}) {
  const total = items.reduce((a, b) => a + b.value, 0);
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  if (!items.length || total <= 0) {
    return (
      <div className="h-[220px] rounded-xl border border-dashed bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">
        No allocation data.
      </div>
    );
  }

  const center = size / 2;
  const radius = size / 2 - 8;
  let start = -Math.PI / 2;

  const slices = items.map((it, idx) => {
    const angle = (it.value / total) * Math.PI * 2;
    const end = start + angle;
    const large = angle > Math.PI ? 1 : 0;
    const x1 = center + radius * Math.cos(start);
    const y1 = center + radius * Math.sin(start);
    const x2 = center + radius * Math.cos(end);
    const y2 = center + radius * Math.sin(end);
    const d = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
    const label = `${it.label} · ${fmtMoney(it.value)}`;
    // A lone slice spans the full circle, where the arc's start and end points coincide
    // and the path renders as nothing — draw it as a circle instead.
    const full = angle >= Math.PI * 2 - 1e-6;
    const out = { d, full, color: it.color, start, end, label, idx };
    start = end;
    return out;
  });

  return (
    <div
      className="relative"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const dist = Math.hypot(x, y);
        if (dist < radius * 0.55 || dist > radius) {
          setHover(null);
          return;
        }
        let angle = Math.atan2(y, x);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;
        const hit = slices.find((s) => angle >= s.start && angle < s.end);
        if (!hit) return;
        setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, label: hit.label });
      }}
      onPointerMove={(e) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const dist = Math.hypot(x, y);
        if (dist < radius * 0.55 || dist > radius) {
          setHover(null);
          return;
        }
        let angle = Math.atan2(y, x);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;
        const hit = slices.find((s) => angle >= s.start && angle < s.end);
        if (!hit) return;
        setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, label: hit.label });
      }}
    >
      <svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} className="w-full h-[220px]">
        {slices.map((s) =>
          s.full ? (
            <circle key={`slice-${s.idx}`} cx={center} cy={center} r={radius} fill={s.color} />
          ) : (
            <path key={`slice-${s.idx}`} d={s.d} fill={s.color} />
          )
        )}
        <circle cx={center} cy={center} r={radius * 0.55} fill="var(--background)" />
        <text x={center} y={center - 2} textAnchor="middle" fontSize="14" fill="var(--muted-foreground)">
          {centerTitle}
        </text>
        <text x={center} y={center + 16} textAnchor="middle" fontSize="16" fill="var(--foreground)" fontWeight="600">
          {centerValue ?? `${items.length} Symbols`}
        </text>
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
