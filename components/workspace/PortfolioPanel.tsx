'use client';

import DataRow from './DataRow';
import Section from './Section';
import StatCard from './StatCard';
import PortfolioCurveChart from './PortfolioCurveChart';
import PortfolioPieChart from './PortfolioPieChart';
import type { DailyPoint } from './types';
import { fmtMoney, formatShortDate } from './utils';

type PortfolioStats = {
  best: DailyPoint;
  worst: DailyPoint;
  avgDaily: number;
};

export default function PortfolioPanel({
  positionsLength,
  cashBalancesLength,
  currentNavTotal,
  currentNavCash,
  currentNavStock,
  currentUnrealized,
  holdingsAllocation,
  cashAllocationNow,
  navComposition,
  navBreakdown,
  series,
  totalCalendarPnl,
  portfolioPeriod,
  portfolioCurve,
  portfolioMidDate,
  portfolioStats,
  baseCurrency,
  portfolioAllocation,
  cashVsTrade,
  cashBreakdown,
  cashByCurrency,
}: {
  positionsLength: number;
  cashBalancesLength: number;
  currentNavTotal: number;
  currentNavCash: number;
  currentNavStock: number;
  currentUnrealized: number;
  holdingsAllocation: { label: string; value: number; color: string }[];
  cashAllocationNow: { label: string; value: number; color: string }[];
  navComposition: { label: string; value: number; color: string }[];
  navBreakdown: { label: string; value: number; color: string }[];
  series: DailyPoint[];
  totalCalendarPnl: number;
  portfolioPeriod: string;
  portfolioCurve: { date: string; cumulative: number }[];
  portfolioMidDate: string;
  portfolioStats: PortfolioStats | null;
  baseCurrency: string;
  portfolioAllocation: { label: string; value: number; color: string }[];
  cashVsTrade: { label: string; value: number; color: string }[];
  cashBreakdown: { label: string; value: number; color: string }[];
  cashByCurrency: { label: string; value: number; color: string }[];
}) {
  // Shares are measured against reported NAV when the statement gives one, otherwise
  // against the magnitudes actually charted.
  const navShareBase = Math.abs(currentNavTotal) || navBreakdown.reduce((acc, r) => acc + Math.abs(r.value), 0);

  return (
    <div>
      <div className="hidden lg:block">
        <div className="text-lg font-semibold">Portfolio Overview</div>
        <div className="text-sm text-muted-foreground">Current state + realized performance from your uploaded statements.</div>
      </div>
      <div className="mt-4 space-y-6">
        <div className="space-y-3">
          <div className="text-base font-semibold">Current State</div>
          <div className="text-sm text-muted-foreground">Net asset value, holdings allocation, and cash balances.</div>

          {!positionsLength && !cashBalancesLength && !currentNavTotal ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Current state data not found in the statement.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard title="Net Liquidation" value={currentNavTotal ? fmtMoney(currentNavTotal) : '—'} />
                <StatCard title="Total Cash" value={currentNavCash ? fmtMoney(currentNavCash) : '—'} />
                <StatCard title="Stock Value" value={currentNavStock ? fmtMoney(currentNavStock) : '—'} />
                <StatCard title="Unrealized P/L" value={currentUnrealized ? fmtMoney(currentUnrealized) : '—'} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
                <Section title="NAV Composition" description="Stock, cash and other asset classes.">
                  <PortfolioPieChart
                    items={navComposition}
                    centerTitle="Net Liquidation"
                    centerValue={currentNavTotal ? fmtMoney(currentNavTotal) : undefined}
                  />
                </Section>
                <Section title="Asset Classes" description="Share of net liquidation value.">
                  <div className="lg:grid lg:grid-cols-2 lg:gap-3">
                    {navBreakdown.map((s) => (
                      <DataRow
                        key={s.label}
                        color={s.color}
                        label={s.label}
                        value={fmtMoney(s.value)}
                        hint={navShareBase > 0 ? `${((Math.abs(s.value) / navShareBase) * 100).toFixed(1)}%` : undefined}
                      />
                    ))}
                    {navBreakdown.length === 0 && (
                      <div className="text-sm text-muted-foreground">No net asset value breakdown detected.</div>
                    )}
                  </div>
                </Section>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
                <Section title="Holdings Allocation" description="Based on current market value.">
                  <PortfolioPieChart items={holdingsAllocation} />
                </Section>
                <Section title="Top Holdings">
                  <div className="lg:grid lg:grid-cols-2 lg:gap-3">
                    {holdingsAllocation.map((s) => (
                      <DataRow key={s.label} color={s.color} label={s.label} value={fmtMoney(s.value)} />
                    ))}
                    {holdingsAllocation.length === 0 && (
                      <div className="text-sm text-muted-foreground">No stock positions detected.</div>
                    )}
                  </div>
                </Section>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
                <Section title="Cash Allocation" description="Cash balances by currency (base value).">
                  <PortfolioPieChart items={cashAllocationNow} />
                </Section>
                <Section title="Cash by Currency">
                  <div className="lg:grid lg:grid-cols-2 lg:gap-3">
                    {cashAllocationNow.map((s) => (
                      <DataRow key={s.label} color={s.color} label={s.label} value={fmtMoney(s.value)} />
                    ))}
                    {cashAllocationNow.length === 0 && (
                      <div className="text-sm text-muted-foreground">No cash balances detected.</div>
                    )}
                  </div>
                </Section>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-base font-semibold">Realized Performance</div>
          <div className="text-sm text-muted-foreground">Realized/cash-only performance from the activity statement.</div>
        </div>

        {!series.length ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Upload an IBKR Activity Statement (CSV) or Firstrade statement (PDF) to render the performance curve.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <Section className="flex-1 lg:bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Cumulative P&amp;L ({baseCurrency})</div>
                    <div className="text-2xl font-semibold">{fmtMoney(totalCalendarPnl)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <div>Period</div>
                    <div className="text-foreground">{portfolioPeriod}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <PortfolioCurveChart points={portfolioCurve.map((p) => ({ date: p.date, cumulative: p.cumulative }))} />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{series.length ? formatShortDate(series[0].date) : '—'}</span>
                    <span>{portfolioMidDate ? formatShortDate(portfolioMidDate) : ''}</span>
                    <span>{series.length ? formatShortDate(series[series.length - 1].date) : '—'}</span>
                  </div>
                </div>
              </Section>

              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:w-56">
                <StatCard title="Avg Daily P&L" value={portfolioStats ? fmtMoney(portfolioStats.avgDaily) : '—'} />
                <StatCard
                  title="Best Day"
                  value={portfolioStats ? `${portfolioStats.best.date} ${fmtMoney(portfolioStats.best.pnl)}` : '—'}
                />
                <StatCard
                  title="Worst Day"
                  value={portfolioStats ? `${portfolioStats.worst.date} ${fmtMoney(portfolioStats.worst.pnl)}` : '—'}
                />
                <StatCard title="Total Days" value={series.length ? series.length.toLocaleString() : '—'} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
              <Section title="Stock Division (Trades)" description="Based on gross trade amounts.">
                <PortfolioPieChart items={portfolioAllocation} />
              </Section>
              <Section title="Top Symbols">
                <div className="lg:grid lg:grid-cols-2 lg:gap-3">
                  {portfolioAllocation.map((s) => (
                    <DataRow key={s.label} color={s.color} label={s.label} value={fmtMoney(s.value)} />
                  ))}
                  {portfolioAllocation.length === 0 && (
                    <div className="text-sm text-muted-foreground">No trade symbols detected.</div>
                  )}
                </div>
              </Section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Section title="Cash vs Trades" description="Gross cash activity vs trade volume.">
                <PortfolioPieChart items={cashVsTrade} />
              </Section>
              <Section title="Cash Components" description="Dividends, interest, fees, withholding.">
                <PortfolioPieChart items={cashBreakdown} />
              </Section>
              <Section title="Cash by Currency" description="Aggregated across activity dates.">
                <PortfolioPieChart items={cashByCurrency} />
              </Section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
