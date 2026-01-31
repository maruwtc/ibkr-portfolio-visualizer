'use client';

import { useRouter } from 'next/navigation';
import { CalendarDays, ListOrdered, MessageCircle, PieChart } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ActiveTab } from './types';

export default function NavTabs({
  activeTab,
  labels,
  isMobile,
}: {
  activeTab: ActiveTab;
  labels: { calendar: string; transactions: string; portfolio: string; chat: string };
  isMobile?: boolean;
}) {
  const router = useRouter();
  const listClassName = isMobile
    ? 'flex w-full justify-between items-center border-b-0 p-0 bg-transparent'
    : 'flex w-full justify-between items-center border-b-0 p-0 bg-transparent border border-muted-foreground/20 rounded-full backdrop-blur-xs';
  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList className={listClassName}>
        <Tooltip>
          <TooltipTrigger asChild>
            <TabsTrigger
              value="calendar"
              aria-label={labels.calendar}
              className="px-2 py-2"
              onClick={() => router.push('/calendar')}
            >
              <CalendarDays className="size-4" />
            </TabsTrigger>
          </TooltipTrigger>
          <TooltipContent>{labels.calendar}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <TabsTrigger
              value="transactions"
              aria-label={labels.transactions}
              className="px-2 py-2"
              onClick={() => router.push('/transactions')}
            >
              <ListOrdered className="size-4" />
            </TabsTrigger>
          </TooltipTrigger>
          <TooltipContent>{labels.transactions}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <TabsTrigger
              value="portfolio"
              aria-label={labels.portfolio}
              className="px-2 py-2"
              onClick={() => router.push('/portfolio')}
            >
              <PieChart className="size-4" />
            </TabsTrigger>
          </TooltipTrigger>
          <TooltipContent>{labels.portfolio}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <TabsTrigger value="chat" aria-label={labels.chat} className="px-2 py-2" onClick={() => router.push('/chat')}>
              <MessageCircle className="size-4" />
            </TabsTrigger>
          </TooltipTrigger>
          <TooltipContent>{labels.chat}</TooltipContent>
        </Tooltip>
      </TabsList>
    </Tabs>
  );
}
