'use client';

import { cn } from '@/lib/utils';
import { TONE_TEXT, type Tone } from './utils';

/**
 * One label/value line — the app's single idiom for a small labelled figure, used by
 * the sidebar summary and both inspector panels.
 *
 * Deliberately borderless: every caller renders these inside a panel or card that
 * already draws a boundary, and giving each row its own outline stacks a third frame
 * around one number. A hairline between rows does the same grouping work.
 */
export default function FieldRow({
  label,
  value,
  unit,
  tone = 'neutral',
  valueClassName,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: Tone;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-2 last:border-b-0">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 text-right text-sm font-medium tabular-nums', TONE_TEXT[tone], valueClassName)}>
        <span className="break-words">{value}</span>
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </dd>
    </div>
  );
}
