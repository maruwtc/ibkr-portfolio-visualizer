'use client';

import { Cloud, HardDrive } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useWorkspace } from './WorkspaceContext';
import type { SourceMode } from './types';

const MODES: { key: SourceMode; label: string; Icon: typeof Cloud }[] = [
  { key: 'local', label: 'Local', Icon: HardDrive },
  { key: 'cloud', label: 'Cloud', Icon: Cloud },
];

/**
 * Chooses how statements are obtained: parsed on this device, or synced from a
 * broker through SnapTrade.
 *
 * Local is the default and the offline guarantee the app is built on, so the switch
 * is deliberately explicit rather than something the app flips on the user's behalf.
 *
 * Deliberately plain buttons rather than shadcn `Tabs`: a second Radix root this
 * early in the rail shifts the `useId` tree the nav's tabs and tooltips are hydrated
 * against, which React reports as a hydration mismatch on every load. The classes
 * below therefore restate what `TabsList`/`TabsTrigger` would have produced, so this
 * reads as one control group with NavTabs beside it — same track, same 28px targets,
 * same active pill. Native `title` stands in for NavTabs' Radix tooltip for the same
 * reason.
 *
 * `fullWidth` spans the two halves across a mobile sheet, where the switch is the
 * only control on its row rather than one group among three.
 */
export default function SourceSwitch({ fullWidth = false, className }: { fullWidth?: boolean; className?: string }) {
  const { sourceMode, setSourceMode } = useWorkspace();

  return (
    <div
      role="group"
      aria-label="Data source"
      className={cn(
        'inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-muted p-1',
        fullWidth ? 'grid w-full grid-cols-2' : 'w-auto shrink-0',
        className
      )}
    >
      {MODES.map(({ key, label, Icon }) => {
        const active = sourceMode === key;
        return (
          <button
            key={key}
            type="button"
            // Icon-only, so the name has to come from the label rather than the content.
            aria-label={label}
            title={label}
            aria-pressed={active}
            onClick={() => setSourceMode(key)}
            className={cn(
              'inline-flex items-center justify-center rounded-md transition-all',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:outline-1',
              fullWidth ? 'h-7 w-full' : 'size-7 flex-none p-0',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
