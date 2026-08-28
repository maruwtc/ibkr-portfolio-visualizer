'use client';

import { cn } from '@/lib/utils';
import { TONE_TEXT, type Tone } from './utils';

/**
 * One headline figure. `unit` carries the currency code so the number itself stays
 * clean, and `tone` colours gains/losses — a stat card is the one place a reader
 * expects to judge a number at a glance without parsing its sign.
 */
export default function StatCard({
  title,
  value,
  hint,
  unit,
  tone = 'neutral',
  size = 'md',
  valueClassName,
  className,
}: {
  title: string;
  value: string;
  hint?: string;
  unit?: string;
  tone?: Tone;
  size?: 'md' | 'lg';
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col rounded-xl border p-3', className)}>
      <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</div>
      {/* Figures step up with the viewport: a nine-digit balance at desktop size
          overruns a two-up card on a phone. */}
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
        <span
          className={cn(
            'font-semibold tabular-nums',
            size === 'lg' ? 'text-lg sm:text-xl lg:text-2xl' : 'text-base lg:text-lg',
            TONE_TEXT[tone],
            valueClassName
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
