'use client';

import React, { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Mobile bottom sheet. The workspace keeps its secondary tools (filters, statement
 * details, the transaction inspector) in here rather than stacked down the page, so a
 * phone shows the active view and little else.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-150" onClick={onClose} />

      <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border-t bg-background shadow-xl animate-in slide-in-from-bottom duration-200">
        <div className="flex justify-center pt-2">
          <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-start justify-between gap-3 px-4 pt-2 pb-3">
          <div className="min-w-0">
            <div className="text-base font-semibold">{title}</div>
            {description && <div className="text-xs text-muted-foreground">{description}</div>}
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
