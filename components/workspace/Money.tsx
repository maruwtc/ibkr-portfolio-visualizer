'use client';

import { cn } from '@/lib/utils';
import { fmtMoney, fmtSignedMoney, TONE_TEXT, type Tone } from './utils';

/**
 * An amount and the currency it is denominated in.
 *
 * Every figure in the app carries its unit, because the statement reports in more than
 * one: net asset value in the base currency, holdings in the instrument's, and the
 * calendar under whichever currency view is selected. A bare number cannot be read
 * without knowing which of those it came from.
 *
 * The unit sizes in `em` so one component serves a 24px headline and a 12px table row.
 */
export default function Money({
  value,
  unit,
  signed = false,
  tone,
  className,
}: {
  value: number;
  /** Currency code, or a basis label such as `ALL (no FX)`. Omitted when unknown. */
  unit?: string;
  signed?: boolean;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={cn('tabular-nums whitespace-nowrap', tone && TONE_TEXT[tone], className)}>
      {signed ? fmtSignedMoney(value) : fmtMoney(value)}
      {unit && <span className="ml-1 text-[0.85em] font-normal text-muted-foreground">{unit}</span>}
    </span>
  );
}
