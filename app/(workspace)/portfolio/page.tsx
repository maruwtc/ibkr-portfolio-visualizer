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
      cashAllocationNow={cashAllocationNow}
      series={series}
      totalCalendarPnl={totalCalendarPnl}
      portfolioPeriod={portfolioPeriod}
      portfolioCurve={portfolioCurve}
      portfolioMidDate={portfolioMidDate}
      portfolioStats={portfolioStats}
      baseCurrency={baseCurrency}
      portfolioAllocation={portfolioAllocation}
      cashVsTrade={cashVsTrade}
      cashBreakdown={cashBreakdown}
      cashByCurrency={cashByCurrency}
    />
  );
}
