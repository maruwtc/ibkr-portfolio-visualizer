'use client';

import { useRouter } from 'next/navigation';
import { CalendarDays, ListOrdered, MessageCircle, PieChart } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ActiveTab } from './types';

type NavKey = 'portfolio' | 'transactions' | 'calendar' | 'chat';

// Display order of the nav.
const TABS: { key: NavKey; href: string; Icon: typeof PieChart }[] = [
  { key: 'portfolio', href: '/portfolio', Icon: PieChart },
  { key: 'transactions', href: '/transactions', Icon: ListOrdered },
  { key: 'calendar', href: '/calendar', Icon: CalendarDays },
  { key: 'chat', href: '/chat', Icon: MessageCircle },
];

export default function NavTabs({
  activeTab,
  labels,
  isMobile,
}: {
  activeTab: ActiveTab;
  labels: Record<NavKey, string>;
  isMobile?: boolean;
}) {
  const router = useRouter();

  // Phones get a labelled bottom bar; tooltips are pointless without a cursor.
  if (isMobile) {
    return (
      <Tabs value={activeTab} className="w-full">
        <TabsList className="flex h-auto w-full items-stretch justify-between border-b-0 bg-transparent p-0">
          {TABS.map(({ key, href, Icon }) => (
            <TabsTrigger
              key={key}
              value={key}
              className={cn(
                'flex h-auto flex-1 flex-col gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium',
                activeTab === key ? 'text-foreground dark:text-foreground' : 'text-muted-foreground'
              )}
              onClick={() => router.push(href)}
            >
              <Icon className={cn('size-5', activeTab === key && 'stroke-[2.5]')} />
              {labels[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    );
  }

  return (
    <Tabs value={activeTab} className="w-auto shrink-0">
      <TabsList className="h-9 w-auto gap-1 rounded-lg bg-muted p-1">
        {TABS.map(({ key, href, Icon }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <TabsTrigger
                value={key}
                aria-label={labels[key]}
                // TooltipTrigger overwrites the data-state that drives the shadcn active
                // styling, so the selected tab is highlighted from the route instead.
                className={cn(
                  'size-7 flex-none rounded-md p-0 text-muted-foreground hover:bg-background/60 hover:text-foreground',
                  // `dark:text-foreground` is not redundant: shadcn's TabsTrigger carries
                  // `dark:text-muted-foreground`, which tailwind-merge keeps (different
                  // variant key) and the cascade then lets beat a plain `text-foreground`
                  // — leaving the selected tab muted in dark mode.
                  activeTab === key && 'bg-background text-foreground shadow-sm dark:text-foreground'
                )}
                onClick={() => router.push(href)}
              >
                <Icon className="size-4" />
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>{labels[key]}</TooltipContent>
          </Tooltip>
        ))}
      </TabsList>
    </Tabs>
  );
}
