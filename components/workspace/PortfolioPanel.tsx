'use client';

import DataRow from './DataRow';
import Section from './Section';
import ShareBars from './ShareBar';
import StatCard from './StatCard';
import PortfolioCurveChart from './PortfolioCurveChart';
import PortfolioPieChart from './PortfolioPieChart';
import type { DailyPoint } from './types';
import { fmtMoney, fmtPct, fmtSignedMoney, formatShortDate, shareOf, toneOf, TONE_TEXT } from './utils';

type PortfolioStats = {
  best: DailyPoint;
  worst: DailyPoint;
  avgDaily: number;
};

import type { AllocationSlice as Slice } from './WorkspaceContext';

export default function PortfolioPanel({
  positionsLength,
  cashBalancesLength,
  currentNavTotal,
  currentNavCash,
  currentNavStock,
  currentUnrealized,
  holdingsAllocation,
  holdingsUnconverted,
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
  realizedUnit,
  selectedCurrency,
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
  holdingsAllocation: Slice[];
  holdingsUnconverted: boolean;
  cashAllocationNow: Slice[];
  navComposition: Slice[];
  navBreakdown: Slice[];
  series: DailyPoint[];
  totalCalendarPnl: number;
  portfolioPeriod: string;
  portfolioCurve: { date: string; cumulative: number }[];
  portfolioMidDate: string;
  portfolioStats: PortfolioStats | null;
  baseCurrency: string;
  /** What realized figures are denominated in — a currency code, or `mixed`. */
  realizedUnit: string;
  selectedCurrency: string;
  portfolioAllocation: Slice[];
  cashVsTrade: Slice[];
  cashBreakdown: Slice[];
  cashByCurrency: Slice[];
}) {
  // Shares are measured against reported NAV when the statement gives one, otherwise
  // against the magnitudes actually charted.
  const navShareBase = Math.abs(currentNavTotal) || navBreakdown.reduce((acc, r) => acc + Math.abs(r.value), 0);
  const stockShare = shareOf(currentNavStock, navShareBase);
  const cashShare = shareOf(currentNavCash, navShareBase);
  const unrealizedShare = shareOf(currentUnrealized, currentNavStock);

  const hasCurrentState = Boolean(positionsLength || cashBalancesLength || currentNavTotal);
  const holdingsTotal = holdingsAllocation.reduce((acc, h) => acc + h.value, 0);
  const cashTotal = cashAllocationNow.reduce((acc, c) => acc + c.value, 0);
  const tradesTotal = portfolioAllocation.reduce((acc, t) => acc + t.value, 0);

  // Current state is always in the base currency; realized performance follows the
  // calendar's currency view, and `realizedUnit` is what those figures are actually in.
  const realizedBasis =
    selectedCurrency === 'ALL'
      ? `Totalled across every currency without FX conversion${realizedUnit === 'mixed' ? '' : ` — all of it ${realizedUnit}`}.`
      : `Totalled in ${realizedUnit}.`;

  return (
    <div>
      <header className="hidden lg:flex lg:items-start lg:justify-between lg:gap-4">
        <div>
          <div className="text-lg font-semibold">Portfolio Overview</div>
          <div className="text-sm text-muted-foreground">Where the money sits today, and what the statement realized.</div>
        </div>
        {/* Nothing loaded means no period and no base currency worth naming. */}
        {series.length > 0 && (
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            <div className="tabular-nums">{portfolioPeriod}</div>
            <div className="mt-0.5">Balances in {baseCurrency}</div>
          </div>
        )}
      </header>

      <div className="mt-4 space-y-8">
        <section className="space-y-4">
          <div>
            <div className="text-base font-semibold">Current State</div>
            <div className="text-sm text-muted-foreground">
              The closing position the statement reports — net asset value, holdings and cash, every figure
              converted to {baseCurrency}.
            </div>
          </div>

          {!hasCurrentState ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Current state data not found in the statement.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  title="Net Liquidation"
                  value={currentNavTotal ? fmtMoney(currentNavTotal) : '—'}
                  unit={currentNavTotal ? baseCurrency : undefined}
                  size="lg"
                />
                <StatCard
                  title="Stock Value"
                  value={currentNavStock ? fmtMoney(currentNavStock) : '—'}
                  unit={currentNavStock ? baseCurrency : undefined}
                  hint={stockShare !== null ? `${fmtPct(stockShare)} of NAV · ${positionsLength} positions` : undefined}
                  size="lg"
                />
                <StatCard
                  title="Total Cash"
                  value={currentNavCash ? fmtMoney(currentNavCash) : '—'}
                  unit={currentNavCash ? baseCurrency : undefined}
                  hint={cashShare !== null ? `${fmtPct(cashShare)} of NAV · ${cashBalancesLength} currencies` : undefined}
                  size="lg"
                />
                <StatCard
                  title="Unrealized P/L"
                  value={currentUnrealized ? fmtSignedMoney(currentUnrealized) : '—'}
                  unit={currentUnrealized ? baseCurrency : undefined}
                  tone={toneOf(currentUnrealized)}
                  hint={unrealizedShare !== null ? `${fmtPct(unrealizedShare)} against stock value` : 'On open positions'}
                  size="lg"
                />
              </div>

              {/* The ring and its breakdown are one statement about one number, so they
                  share a card rather than facing each other across a gutter. */}
              <Section title="Net Asset Value" description="How the closing balance splits across asset classes.">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr] lg:items-center lg:gap-8">
                  <PortfolioPieChart
                    items={navComposition}
                    legend={false}
                    centerTitle="Net Liquidation"
                    centerValue={currentNavTotal ? fmtMoney(currentNavTotal) : undefined}
                    unit={baseCurrency}
                  />
                  <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">
                    {navBreakdown.map((s) => (
                      <DataRow
                        key={s.label}
                        color={s.color}
                        label={s.label}
                        value={fmtMoney(s.value)}
                        unit={baseCurrency}
                        hint={navShareBase > 0 ? fmtPct(Math.abs(s.value) / navShareBase) : undefined}
                      />
                    ))}
                    {navBreakdown.length === 0 && (
                      <div className="text-sm text-muted-foreground">No net asset value breakdown detected.</div>
                    )}
                  </div>
                </div>
              </Section>

              {/* Cash usually has a handful of rows against a long holdings list, so it
                  takes the narrow column and lets holdings run two-up beside it. */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
                <Section
                  title="Cash Balances"
                  description={`Each currency's balance, converted to ${baseCurrency}.`}
                  action={
                    cashAllocationNow.length ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {fmtMoney(cashTotal)} {baseCurrency}
                      </span>
                    ) : undefined
                  }
                >
                  <ShareBars items={cashAllocationNow} unit={baseCurrency} emptyMessage="No cash balances detected." />
                </Section>

                <Section
                  title="Top Holdings"
                  description={
                    positionsLength > holdingsAllocation.length
                      ? `Largest ${holdingsAllocation.length} of ${positionsLength} positions, market value in ${baseCurrency}.`
                      : `Current market value, in ${baseCurrency}, largest first.`
                  }
                  action={
                    holdingsAllocation.length ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {fmtMoney(holdingsTotal)} {baseCurrency}
                      </span>
                    ) : undefined
                  }
                >
                  <ShareBars items={holdingsAllocation} columns={2} unit={baseCurrency} emptyMessage="No stock positions detected." />
                  {holdingsUnconverted && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Some holdings are shown in their own currency — the statement gave no rate to convert
                      them, so this total mixes currencies.
                    </p>
                  )}
                </Section>
              </div>
            </>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <div className="text-base font-semibold">Realized Performance</div>
            <div className="text-sm text-muted-foreground">
              Cash and realized results booked over the statement period, excluding unrealized moves.{' '}
              {realizedBasis}
            </div>
          </div>

          {!series.length ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Upload an IBKR Activity Statement (CSV) or Firstrade statement (PDF) to render the performance curve.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 lg:flex-row">
                <Section className="flex-1 lg:bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Cumulative P&amp;L</div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className={`text-3xl font-semibold tabular-nums ${TONE_TEXT[toneOf(totalCalendarPnl)]}`}>
                          {fmtSignedMoney(totalCalendarPnl)}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">{realizedUnit}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>Over {series.length.toLocaleString()} active days</div>
                      <div className="mt-0.5 tabular-nums">{portfolioPeriod}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <PortfolioCurveChart
                      points={portfolioCurve.map((p) => ({ date: p.date, cumulative: p.cumulative }))}
                      unit={realizedUnit}
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatShortDate(series[0].date)}</span>
                      <span>{portfolioMidDate ? formatShortDate(portfolioMidDate) : ''}</span>
                      <span>{formatShortDate(series[series.length - 1].date)}</span>
                    </div>
                  </div>
                </Section>

                <div className="grid grid-cols-2 gap-3 lg:w-60 lg:grid-cols-1">
                  <StatCard
                    title="Avg Daily P&L"
                    value={portfolioStats ? fmtSignedMoney(portfolioStats.avgDaily) : '—'}
                    unit={portfolioStats ? realizedUnit : undefined}
                    tone={toneOf(portfolioStats?.avgDaily)}
                  />
                  <StatCard
                    title="Best Day"
                    value={portfolioStats ? fmtSignedMoney(portfolioStats.best.pnl) : '—'}
                    unit={portfolioStats ? realizedUnit : undefined}
                    hint={portfolioStats?.best.date}
                    tone={toneOf(portfolioStats?.best.pnl)}
                  />
                  <StatCard
                    title="Worst Day"
                    value={portfolioStats ? fmtSignedMoney(portfolioStats.worst.pnl) : '—'}
                    unit={portfolioStats ? realizedUnit : undefined}
                    hint={portfolioStats?.worst.date}
                    tone={toneOf(portfolioStats?.worst.pnl)}
                  />
                  <StatCard title="Active Days" value={series.length.toLocaleString()} hint="Days with booked activity" />
                </div>
              </div>

              <Section
                title="Most Traded Symbols"
                description={`Largest ${portfolioAllocation.length} by gross trade value over the period.`}
                action={
                  portfolioAllocation.length ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {fmtMoney(tradesTotal)} {realizedUnit}
                    </span>
                  ) : undefined
                }
              >
                <ShareBars items={portfolioAllocation} columns={2} unit={realizedUnit} emptyMessage="No trade symbols detected." />
              </Section>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Section title="Cash vs Trades" description="Gross cash activity against trade volume.">
                  <PortfolioPieChart items={cashVsTrade} centerTitle="Gross activity" unit={realizedUnit} />
                </Section>
                <Section title="Cash Components" description="Dividends, interest, fees and withholding.">
                  <PortfolioPieChart items={cashBreakdown} centerTitle="Cash flow" unit={realizedUnit} />
                </Section>
                <Section title="Cash Flow by Currency" description="Aggregated across activity dates.">
                  <PortfolioPieChart items={cashByCurrency} centerTitle="Cash flow" unit={realizedUnit} />
                </Section>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
