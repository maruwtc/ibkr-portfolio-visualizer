'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { MonthNavigator } from './CalendarControls';
import { useWorkspace } from './WorkspaceContext';
import StatCard from './StatCard';
import { fmtMoney, fmtSignedMoney, heatBackground, quantizeIntensity, toneOf } from './utils';

export default function CalendarPanel() {
  const { activeMonth, monthStats, activeMonthCells, realizedUnit, maxAbsPnl, currentNavTotal } = useWorkspace();

  return (
    <div>
      <div className="hidden lg:block">
        <div className="text-lg font-semibold">Calendar</div>
        <div className="text-sm text-muted-foreground">Hover cells for a quick view.</div>
      </div>
      <div className="mt-4 space-y-4">
        {!activeMonth && (
          <Alert>
            <AlertTitle>No month selected</AlertTitle>
            <AlertDescription>Upload a statement, then pick a month from the controls on the left.</AlertDescription>
          </Alert>
        )}

        {monthStats && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                title="Month P&L"
                value={fmtSignedMoney(monthStats.sumPnl)}
                unit={realizedUnit}
                tone={toneOf(monthStats.sumPnl)}
              />
              <StatCard
                title="Win Days"
                value={`${monthStats.winDays}/${monthStats.days}`}
                hint={monthStats.days ? `${((monthStats.winDays / monthStats.days) * 100).toFixed(0)}% of active days` : undefined}
              />
              <StatCard
                title="Best Day"
                value={fmtSignedMoney(monthStats.best.pnl)}
                unit={realizedUnit}
                hint={monthStats.best.date}
                tone={toneOf(monthStats.best.pnl)}
              />
              <StatCard
                title="Worst Day"
                value={fmtSignedMoney(monthStats.worst.pnl)}
                unit={realizedUnit}
                hint={monthStats.worst.date}
                tone={toneOf(monthStats.worst.pnl)}
              />
            </div>
            <Separator />
          </>
        )}

        {/* Desktop drives the month from the left column; phones have no such column,
            so the navigator stays with the grid there. */}
        <div className="lg:hidden">
          <MonthNavigator />
        </div>

        <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Amounts in <span className="font-medium text-foreground">{realizedUnit}</span>
          </span>
          <span>Second line is the day against net liquidation value.</span>
        </div>

        <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {activeMonthCells.map((c) => {
            const pnl = c.data?.pnl ?? 0;
            const intensity = quantizeIntensity(pnl, maxAbsPnl);
            const profitPct = currentNavTotal ? (pnl / currentNavTotal) * 100 : null;

            return (
              <Tooltip key={c.date}>
                <TooltipTrigger asChild>
                  <button
                    style={{ background: heatBackground(pnl, intensity) }}
                    className={[
                      'cal-cell flex h-20 flex-col rounded-xl p-2 text-left transition hover:scale-[1.02] hover:shadow',
                      c.inMonth ? '' : 'opacity-40',
                      pnl === 0 ? 'text-muted-foreground' : 'text-foreground',
                    ].join(' ')}
                  >
                    <div className="flex flex-col items-start justify-between gap-1">
                      <span className="text-xs font-medium">{c.day}</span>
                      {c.data ? (
                        <>
                          <span className="max-w-full truncate rounded-sm bg-background/60 px-1 py-0.5 text-[10px] leading-tight font-medium tabular-nums">
                            {pnl > 0 ? '+' : ''}
                            {fmtMoney(pnl)}
                          </span>
                          <span className="max-w-full truncate rounded-sm bg-background/60 px-1 py-0.5 text-[10px] leading-tight tabular-nums">
                            {profitPct !== null ? `${profitPct > 0 ? '+' : ''}${profitPct.toFixed(2)}%` : '—'}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] opacity-70">—</span>
                      )}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="text-sm font-medium">{c.date}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    P&amp;L:{' '}
                    <span className="font-medium text-foreground tabular-nums">
                      {c.data ? `${fmtMoney(c.data.pnl)} ${realizedUnit}` : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Profit %:{' '}
                    <span className="font-medium text-foreground">
                      {profitPct !== null ? `${profitPct > 0 ? '+' : ''}${profitPct.toFixed(2)}%` : '—'}
                    </span>
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
