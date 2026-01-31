'use client';

export default function InspectorField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium break-words">{value}</div>
    </div>
  );
}
