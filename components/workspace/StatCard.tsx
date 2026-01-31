'use client';

export default function StatCard({
  title,
  value,
  valueClassName,
}: {
  title: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border p-3 flex flex-col">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className={['mt-1 text-md font-semibold', valueClassName].filter(Boolean).join(' ')}>{value}</div>
    </div>
  );
}
