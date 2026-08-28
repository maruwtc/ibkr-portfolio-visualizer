'use client';

import Money from './Money';
import { fmtPct } from './utils';

type Item = {
  label: string;
  value: number;
  color: string;
  /** The same amount before conversion, shown when the row is labelled by currency. */
  native?: { value: number; currency: string };
};

/**
 * A ranked breakdown as label / bar / value rows.
 *
 * A donut can only be read for two or three slices; a top-8 holdings list read off a
 * ring forces the eye back and forth to a legend. Bars sort themselves, put the
 * magnitudes on a shared baseline, and leave room for the share percentage that the
 * question "how concentrated am I?" actually needs.
 */
export default function ShareBars({
  items,
  total,
  unit,
  emptyMessage = 'No data.',
  columns = 1,
}: {
  items: Item[];
  /** Denominator for the share column; defaults to the sum of the items shown. */
  total?: number;
  /** Currency the row values are denominated in. */
  unit?: string;
  emptyMessage?: string;
  columns?: 1 | 2;
}) {
  if (!items.length) return <div className="text-sm text-muted-foreground">{emptyMessage}</div>;

  const sum = items.reduce((acc, i) => acc + Math.abs(i.value), 0);
  const denom = Math.abs(total ?? sum) || 1;
  // Bars are scaled to the largest row so the smallest slices stay visible.
  const peak = Math.max(...items.map((i) => Math.abs(i.value)), 1);

  return (
    <div className={columns === 2 ? 'grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-2' : 'space-y-3'}>
      {items.map((item) => {
        const share = Math.abs(item.value) / denom;
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 text-right text-sm">
                <Money value={item.value} unit={unit} />
                <span className="ml-2 text-xs text-muted-foreground">{fmtPct(share)}</span>
                {/* A row named for a currency but valued in another needs both stated,
                    or "USD 204,896.30" reads as dollars. */}
                {item.native && (
                  <span className="block text-xs text-muted-foreground">
                    <Money value={item.native.value} unit={item.native.currency} />
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max((Math.abs(item.value) / peak) * 100, 1.5)}%`, background: item.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
