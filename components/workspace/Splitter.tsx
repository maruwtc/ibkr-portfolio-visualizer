'use client';

export default function Splitter({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="relative w-2 cursor-col-resize bg-border/60 hover:bg-border transition"
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-border" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background px-1 py-2 shadow-sm">
        <div className="h-4 w-1 rounded-full bg-muted" />
      </div>
    </div>
  );
}
