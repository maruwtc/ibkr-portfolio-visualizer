'use client';

import React from 'react';

/**
 * One colour-keyed line of a breakdown list, read as the legend of the chart beside it.
 *
 * Borderless: it always sits inside a section card, and outlining each entry would put
 * a box inside a box. Phones stack these in one column, where a hairline groups them;
 * from lg up they flow into a grid, where a trailing rule under only some cells would
 * be arbitrary, so spacing carries the grouping instead.
 */
export default function DataRow({
  label,
  value,
  unit,
  hint,
  color,
}: {
  label: string;
  value: string;
  /** Currency the value is denominated in. */
  unit?: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0 lg:border-b-0 lg:py-2">
      <div className="flex min-w-0 items-center gap-2">
        {color && <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />}
        <span className="truncate text-sm font-medium">{label}</span>
      </div>
      <div className="shrink-0 text-sm text-muted-foreground">
        <span className="tabular-nums text-foreground">{value}</span>
        {unit && <span className="ml-1 text-xs">{unit}</span>}
        {hint && <span className="ml-2 text-xs">{hint}</span>}
      </div>
    </div>
  );
}
