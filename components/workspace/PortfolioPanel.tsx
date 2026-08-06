'use client';

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
  return (
    <div>
      <div className="text-lg font-semibold">Portfolio Overview</div>
      <div className="text-sm text-muted-foreground">Current state + realized performance from your uploaded statements.</div>
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
                <div className="rounded-2xl border p-4">
                  <div className="text-sm text-muted-foreground">Holdings Allocation</div>
                  <div className="text-xs text-muted-foreground">Based on current market value.</div>
                  <div className="mt-3">
                    <PortfolioPieChart items={holdingsAllocation} />
                  </div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="text-sm text-muted-foreground">Top Holdings</div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {holdingsAllocation.map((s) => (
                      <div key={s.label} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                          <span className="text-sm font-medium">{s.label}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{fmtMoney(s.value)}</div>
                      </div>
                    ))}
                    {holdingsAllocation.length === 0 && (
                      <div className="text-sm text-muted-foreground">No stock positions detected.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
                <div className="rounded-2xl border p-4">
                  <div className="text-sm text-muted-foreground">Cash Allocation</div>
                  <div className="text-xs text-muted-foreground">Cash balances by currency (base value).</div>
                  <div className="mt-3">
                    <PortfolioPieChart items={cashAllocationNow} />
                  </div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="text-sm text-muted-foreground">Cash by Currency</div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {cashAllocationNow.map((s) => (
                      <div key={s.label} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                          <span className="text-sm font-medium">{s.label}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{fmtMoney(s.value)}</div>
                      </div>
                    ))}
                    {cashAllocationNow.length === 0 && (
                      <div className="text-sm text-muted-foreground">No cash balances detected.</div>
                    )}
                  </div>
                </div>
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
              <div className="flex-1 rounded-2xl border p-4 bg-muted/20">
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
              </div>

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
              <div className="rounded-2xl border p-4">
                <div className="text-sm text-muted-foreground">Stock Division (Trades)</div>
                <div className="text-xs text-muted-foreground">Based on gross trade amounts.</div>
                <div className="mt-3">
                  <PortfolioPieChart items={portfolioAllocation} />
                </div>
              </div>
              <div className="rounded-2xl border p-4">
                <div className="text-sm text-muted-foreground">Top Symbols</div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {portfolioAllocation.map((s) => (
                    <div key={s.label} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        <span className="text-sm font-medium">{s.label}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{fmtMoney(s.value)}</div>
                    </div>
                  ))}
                  {portfolioAllocation.length === 0 && (
                    <div className="text-sm text-muted-foreground">No trade symbols detected.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border p-4">
                <div className="text-sm text-muted-foreground">Cash vs Trades</div>
                <div className="text-xs text-muted-foreground">Gross cash activity vs trade volume.</div>
                <div className="mt-3">
                  <PortfolioPieChart items={cashVsTrade} />
                </div>
              </div>
              <div className="rounded-2xl border p-4">
                <div className="text-sm text-muted-foreground">Cash Components</div>
                <div className="text-xs text-muted-foreground">Dividends, interest, fees, withholding.</div>
                <div className="mt-3">
                  <PortfolioPieChart items={cashBreakdown} />
                </div>
              </div>
              <div className="rounded-2xl border p-4">
                <div className="text-sm text-muted-foreground">Cash by Currency</div>
                <div className="text-xs text-muted-foreground">Aggregated across activity dates.</div>
                <div className="mt-3">
                  <PortfolioPieChart items={cashByCurrency} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
