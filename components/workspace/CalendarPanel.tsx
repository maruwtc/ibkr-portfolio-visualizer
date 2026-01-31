'use client';

import gsap from 'gsap';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { useWorkspace } from './WorkspaceContext';
import StatCard from './StatCard';
import { fmtMoney, quantizeIntensity } from './utils';

export default function CalendarPanel() {
  const {
    activeMonth,
    setActiveMonth,
    monthStats,
    months,
    activeMonthCells,
    currencyLabel,
    maxAbsPnl,
  } = useWorkspace();

  return (
    <div>
      <div className="text-lg font-semibold">Calendar</div>
      <div className="text-sm text-muted-foreground">Hover cells for a quick view.</div>
      <div className="mt-4 space-y-4">
        {!activeMonth && (
          <Alert>
            <AlertTitle>No month selected</AlertTitle>
            <AlertDescription>
              Upload CSV and select a month. If you already have data, pick from the month buttons below.
            </AlertDescription>
          </Alert>
        )}

        {monthStats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <StatCard title="Month P&L" value={fmtMoney(monthStats.sumPnl)} />
              <StatCard title="Win Days" value={`${monthStats.winDays}/${monthStats.days}`} />
              <StatCard
                title="Best Day"
                value={`${monthStats.best.date}\n${fmtMoney(monthStats.best.pnl)}`}
                valueClassName="text-sm leading-5 md:text-base md:leading-6 break-words whitespace-pre-line"
              />
              <StatCard
                title="Worst Day"
                value={`${monthStats.worst.date}\n${fmtMoney(monthStats.worst.pnl)}`}
                valueClassName="text-sm leading-5 md:text-base md:leading-6 break-words whitespace-pre-line"
              />
            </div>
            <Separator />
          </>
        )}

        <div className="flex gap-2 flex-wrap items-center justify-between">
          <div className="text-sm text-muted-foreground">Month</div>
          <div className="flex gap-2 flex-wrap">
            {months.slice(-18).map((m) => (
              <Button
                key={m}
                size="xs"
                variant={m === activeMonth ? 'default' : 'outline'}
                onClick={() => {
                  setActiveMonth(m);
                  gsap.fromTo('.cal-cell', { scale: 0.985, opacity: 0.65 }, { scale: 1, opacity: 1, duration: 0.28, stagger: 0.008, ease: 'power2.out' });
                }}
              >
                {m}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="px-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {activeMonthCells.map((c) => {
            const pnl = c.data?.pnl ?? 0;
            const intensity = quantizeIntensity(pnl, maxAbsPnl);
            const isPos = pnl > 0;

            const bg = pnl === 0 ? 'bg-muted' : isPos ? 'bg-emerald-500' : 'bg-rose-500';
            const opacity =
              pnl === 0
                ? 'opacity-50'
                : intensity < 0.2
                  ? 'opacity-30'
                  : intensity < 0.4
                    ? 'opacity-45'
                    : intensity < 0.6
                      ? 'opacity-60'
                      : intensity < 0.8
                        ? 'opacity-75'
                        : 'opacity-90';
            const textColor = pnl === 0 ? 'text-muted-foreground' : 'text-white';

            return (
              <Tooltip key={c.date}>
                <TooltipTrigger asChild>
                  <button
                    className={[
                      'cal-cell rounded-xl h-16 sm:h-20 p-2 text-left transition hover:scale-[1.02] hover:shadow flex flex-col',
                      c.inMonth ? '' : 'opacity-40',
                      bg,
                      opacity,
                      textColor,
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-medium">{c.day}</span>
                      {c.data ? (
                        <span className="text-[10px] sm:text-[11px] leading-tight px-1.5 py-0.5 rounded-full bg-white/20 text-white border border-white/10 max-w-full truncate">
                          {pnl > 0 ? '+' : ''}
                          {fmtMoney(pnl)}
                        </span>
                      ) : (
                        <span className="text-[11px] opacity-70">—</span>
                      )}
                    </div>
                    <div className="mt-auto text-[11px] leading-4 opacity-90">{c.data ? 'P&L' : ''}</div>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="text-sm font-medium">{c.date}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    P&L ({currencyLabel}):{' '}
                    <span className="font-medium text-foreground">{c.data ? fmtMoney(c.data.pnl) : '—'}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
