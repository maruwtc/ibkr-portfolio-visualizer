'use client';

import React from 'react';

/**
 * One label/value line in a breakdown list. A divider on phones, a bordered pill from
 * lg up — a column of bordered pills inside an already-bordered section reads as noise
 * on a narrow screen.
 */
export default function DataRow({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0 lg:rounded-xl lg:border lg:px-3 lg:py-2">
      <div className="flex min-w-0 items-center gap-2">
        {color && <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />}
        <span className="truncate text-sm font-medium">{label}</span>
      </div>
      <div className="shrink-0 text-sm text-muted-foreground">
        {value}
        {hint && <span className="ml-2 text-xs">{hint}</span>}
      </div>
    </div>
  );
}
