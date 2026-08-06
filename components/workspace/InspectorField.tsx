'use client';

/**
 * One inspector label/value. A divider line on phones (a column of bordered boxes
 * inside the detail sheet is a lot of chrome for one number each), boxed from lg up.
 */
export default function InspectorField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-2 last:border-b-0 lg:block lg:rounded-xl lg:border-b lg:border lg:p-3">
      <div className="shrink-0 text-xs text-muted-foreground">{label}</div>
      <div className="break-words text-right font-medium lg:mt-1 lg:text-left">{value}</div>
    </div>
  );
}
