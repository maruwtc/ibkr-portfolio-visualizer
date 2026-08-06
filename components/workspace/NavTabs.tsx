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
  const listClassName = isMobile
    ? 'flex w-full justify-between items-center border-b-0 p-0 bg-transparent'
    : 'flex w-full justify-between items-center border-b-0 p-0 bg-transparent border border-muted-foreground/20 rounded-full backdrop-blur-xs';

  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList className={listClassName}>
        {TABS.map(({ key, href, Icon }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <TabsTrigger
                value={key}
                aria-label={labels[key]}
                // TooltipTrigger overwrites the data-state that drives the shadcn active
                // styling, so the selected tab is highlighted from the route instead.
                className={cn(
                  'px-2 py-2',
                  activeTab === key && 'bg-muted text-foreground shadow-sm'
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
