'use client';

import PortfolioPanel from '@/components/workspace/PortfolioPanel';
import { useWorkspace } from '@/components/workspace/WorkspaceContext';

export default function PortfolioPage() {
  const {
    positions,
    cashBalances,
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
  } = useWorkspace();

  return (
    <PortfolioPanel
      positionsLength={positions.length}
      cashBalancesLength={cashBalances.length}
      currentNavTotal={currentNavTotal}
      currentNavCash={currentNavCash}
      currentNavStock={currentNavStock}
      currentUnrealized={currentUnrealized}
      holdingsAllocation={holdingsAllocation}
      holdingsUnconverted={holdingsUnconverted}
      cashAllocationNow={cashAllocationNow}
      navComposition={navComposition}
      navBreakdown={navBreakdown}
      series={series}
      totalCalendarPnl={totalCalendarPnl}
      portfolioPeriod={portfolioPeriod}
      portfolioCurve={portfolioCurve}
      portfolioMidDate={portfolioMidDate}
      portfolioStats={portfolioStats}
      baseCurrency={baseCurrency}
      realizedUnit={realizedUnit}
      selectedCurrency={selectedCurrency}
      portfolioAllocation={portfolioAllocation}
      cashVsTrade={cashVsTrade}
      cashBreakdown={cashBreakdown}
      cashByCurrency={cashByCurrency}
    />
  );
}
