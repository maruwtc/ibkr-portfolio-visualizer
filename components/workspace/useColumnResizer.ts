'use client';

import { useCallback, useRef, useState } from 'react';

import type { Sizes } from './types';
import { clamp } from './utils';

export default function useColumnResizer(initial: Sizes) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sizes, setSizes] = useState<Sizes>(initial);

  const startDrag = useCallback(
    (which: 'lm' | 'mr') => (e: React.PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;

      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const rect = el.getBoundingClientRect();
      const startX = e.clientX;
      const start = sizes;

      const minLeft = 260;
      const minMid = 520;
      const minRight = 320;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;

        if (which === 'lm') {
          const nextLeft = clamp(start.left + dx, minLeft, rect.width - minMid - minRight);
          const remaining = rect.width - nextLeft;
          const nextMid = clamp(start.mid, minMid, remaining - minRight);
          setSizes({ left: nextLeft, mid: nextMid, right: Math.max(minRight, rect.width - nextLeft - nextMid) });
        } else {
          const nextMid = clamp(start.mid + dx, minMid, rect.width - start.left - minRight);
          setSizes({ left: start.left, mid: nextMid, right: Math.max(minRight, rect.width - start.left - nextMid) });
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [sizes]
  );

  return { containerRef, sizes, startDrag, setSizes };
}
