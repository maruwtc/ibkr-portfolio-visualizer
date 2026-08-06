'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import InspectorField from './InspectorField';
import type { ActiveTab, MonthStats, Transaction } from './types';
import { fmtMode, fmtMoney, fmtShareDetail, fmtTxnType, reinvestedValue, typeBadgeVariant } from './utils';

export default function RightPanel({
  activeTab,
  seriesLength,
  rawNames,
  mode,
  selectedTxn,
  currencyLabel,
  totalCalendarPnl,
  transactionsLength,
  baseCurrency,
  activeMonth,
  monthStats,
}: {
  activeTab: ActiveTab;
  seriesLength: number;
  rawNames: string[];
  mode: string;
  selectedTxn: Transaction | null;
  currencyLabel: string;
  totalCalendarPnl: number;
  transactionsLength: number;
  baseCurrency: string;
  activeMonth: string;
  monthStats: MonthStats | null;
}) {
  if (!seriesLength && !rawNames.length) {
    return (
      <div className="h-full">
        <div className="text-base">Quick Help</div>
        <div className="text-sm text-muted-foreground">Upload an IBKR Activity Statement (CSV) or a Firstrade statement (PDF) to start.</div>
        <div className="space-y-1 mt-3 text-sm">
          <div>• Drag & drop CSV or PDF files on the left panel.</div>
          <div>• Calendar is realized/cash only (no unrealized MTM).</div>
          <div>• Use Transactions tab for detailed ledger.</div>
        </div>
      </div>
    );
  }

  if (activeTab === 'transactions') {
    return (
      // Inside the mobile sheet the card chrome and heading are redundant.
      <Card className="h-full border-0 py-0 shadow-none lg:border lg:py-6 lg:shadow-sm">
        <CardHeader className="hidden lg:grid">
          <CardTitle className="text-base">Transaction Inspector</CardTitle>
          <CardDescription>Click a row to drill down.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-0 lg:px-6">
          {!selectedTxn ? (
            <div className="text-sm text-muted-foreground">No transaction selected.</div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={typeBadgeVariant(selectedTxn.type)}>{fmtTxnType(selectedTxn.type)}</Badge>
                <Badge variant="outline">{selectedTxn.currency}</Badge>
                <Badge variant="outline">{selectedTxn.date}</Badge>
                {selectedTxn.symbol && <Badge variant="secondary">{selectedTxn.symbol}</Badge>}
                {selectedTxn.drip && <Badge variant="outline">DRIP</Badge>}
                {selectedTxn.sourceFile && <Badge variant="outline">{selectedTxn.sourceFile}</Badge>}
              </div>

              <Separator />

              <div className="text-lg font-semibold">{selectedTxn.title}</div>
              {selectedTxn.description && <div className="text-sm text-muted-foreground">{selectedTxn.description}</div>}

              <Separator />

              <div className="grid grid-cols-1 gap-3">
                <InspectorField label="Amount" value={`${selectedTxn.amount >= 0 ? '+' : ''}${fmtMoney(selectedTxn.amount)}`} />
                <InspectorField label="Side" value={selectedTxn.side ?? '—'} />
                <InspectorField label="Quantity" value={selectedTxn.quantity !== undefined ? selectedTxn.quantity.toLocaleString() : '—'} />
                <InspectorField
                  label="Trade Price"
                  value={selectedTxn.tradePrice !== undefined ? selectedTxn.tradePrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}
                />
                <InspectorField label="Fees" value={selectedTxn.fee !== undefined ? fmtMoney(selectedTxn.fee) : '—'} />
                <InspectorField label="Realized P/L" value={selectedTxn.realizedPnl !== undefined ? fmtMoney(selectedTxn.realizedPnl) : '—'} />
                {selectedTxn.drip && (
                  <InspectorField
                    label="Dividend Reinvested"
                    value={[
                      reinvestedValue(selectedTxn) !== null ? fmtMoney(reinvestedValue(selectedTxn) as number) : null,
                      fmtShareDetail(selectedTxn),
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  />
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">Raw fields</div>
                <div className="rounded-xl border p-3">
                  <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(selectedTxn.raw ?? {}, null, 2)}</pre>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full w-full">
      <div className="text-base">Summary</div>
      <div className="text-sm text-muted-foreground">Context for the selected tab.</div>
      <div className="mt-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {rawNames.length > 0 && (
            <Badge variant="secondary">
              {rawNames[0]}
              {rawNames.length > 1 ? ` +${rawNames.length - 1}` : ''}
            </Badge>
          )}
          <Badge>{fmtMode(mode)}</Badge>
        </div>

        {monthStats && (
          <>
            <Separator />
            <div className="grid grid-cols-1 gap-3">
              <InspectorField label="Month P&L" value={fmtMoney(monthStats.sumPnl)} />
              <InspectorField label="Win Days" value={`${monthStats.winDays}/${monthStats.days}`} />
              <InspectorField label="Best Day" value={`${monthStats.best.date}  ${fmtMoney(monthStats.best.pnl)}`} />
              <InspectorField label="Worst Day" value={`${monthStats.worst.date}  ${fmtMoney(monthStats.worst.pnl)}`} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
