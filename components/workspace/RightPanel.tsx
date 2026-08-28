'use client';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import FieldRow from './FieldRow';
import type { ActiveTab, MonthStats, Transaction } from './types';
import {
  fmtMode,
  fmtMoney,
  fmtShareDetail,
  fmtSignedMoney,
  fmtTxnType,
  heatBackground,
  reinvestedValue,
  toneOf,
  typeBadgeVariant,
} from './utils';

export default function RightPanel({
  activeTab,
  seriesLength,
  rawNames,
  mode,
  selectedTxn,
  realizedUnit,
  totalCalendarPnl,
  transactionsLength,
  activeMonth,
  monthStats,
}: {
  activeTab: ActiveTab;
  seriesLength: number;
  rawNames: string[];
  mode: string;
  selectedTxn: Transaction | null;
  realizedUnit: string;
  totalCalendarPnl: number;
  transactionsLength: number;
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
      // The panel column (or the mobile sheet) already frames this, so the inspector
      // is a plain heading and content rather than a card inside that frame.
      <div className="h-full w-full">
        <div className="hidden lg:block">
          <div className="text-base font-semibold">Transaction Inspector</div>
          <div className="text-sm text-muted-foreground">Click a row to drill down.</div>
        </div>
        <div className="space-y-3 lg:mt-4">
          {!selectedTxn ? (
            <div className="text-sm text-muted-foreground">No transaction selected.</div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={typeBadgeVariant(selectedTxn.type)}>{fmtTxnType(selectedTxn.type)}</Badge>
                <Badge variant="outline">{selectedTxn.date}</Badge>
                {selectedTxn.symbol && <Badge variant="secondary">{selectedTxn.symbol}</Badge>}
                {selectedTxn.drip && <Badge variant="outline">DRIP</Badge>}
                {selectedTxn.sourceFile && <Badge variant="outline">{selectedTxn.sourceFile}</Badge>}
              </div>

              <Separator />

              <div className="text-lg font-semibold">{selectedTxn.title}</div>
              {selectedTxn.description && <div className="text-sm text-muted-foreground">{selectedTxn.description}</div>}

              <Separator />

              <dl>
                <FieldRow
                  label="Amount"
                  value={fmtSignedMoney(selectedTxn.amount)}
                  unit={selectedTxn.currency}
                  tone={toneOf(selectedTxn.amount)}
                />
                <FieldRow label="Side" value={selectedTxn.side ?? '—'} />
                <FieldRow label="Quantity" value={selectedTxn.quantity !== undefined ? selectedTxn.quantity.toLocaleString() : '—'} />
                <FieldRow
                  label="Trade Price"
                  value={
                    selectedTxn.tradePrice !== undefined
                      ? selectedTxn.tradePrice.toLocaleString(undefined, { maximumFractionDigits: 4 })
                      : '—'
                  }
                  unit={selectedTxn.tradePrice !== undefined ? selectedTxn.currency : undefined}
                />
                <FieldRow
                  label="Fees"
                  value={selectedTxn.fee !== undefined ? fmtMoney(selectedTxn.fee) : '—'}
                  unit={selectedTxn.fee !== undefined ? selectedTxn.currency : undefined}
                />
                <FieldRow
                  label="Realized P/L"
                  value={selectedTxn.realizedPnl !== undefined ? fmtSignedMoney(selectedTxn.realizedPnl) : '—'}
                  unit={selectedTxn.realizedPnl !== undefined ? selectedTxn.currency : undefined}
                  tone={toneOf(selectedTxn.realizedPnl)}
                />
                {selectedTxn.drip && (
                  <FieldRow
                    label="Dividend Reinvested"
                    value={[
                      reinvestedValue(selectedTxn) !== null
                        ? `${fmtMoney(reinvestedValue(selectedTxn) as number)} ${selectedTxn.currency}`
                        : null,
                      fmtShareDetail(selectedTxn),
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  />
                )}
              </dl>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">Raw fields</div>
                {/* A tint separates the dump from the fields above without a third outline. */}
                <pre className="rounded-lg bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(selectedTxn.raw ?? {}, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // The month's headline figures already sit above the grid in the calendar itself, so
  // this column carries what the grid cannot say for itself: how to read its colours,
  // and where the month sits against the whole statement.
  const monthShare =
    monthStats && totalCalendarPnl ? (monthStats.sumPnl / totalCalendarPnl) * 100 : null;

  return (
    <div className="h-full w-full">
      <div className="text-base font-semibold">Summary</div>
      <div className="text-sm text-muted-foreground">How to read {activeMonth || 'the calendar'}.</div>

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {rawNames.length > 0 && (
            <Badge variant="secondary">
              {rawNames[0]}
              {rawNames.length > 1 ? ` +${rawNames.length - 1}` : ''}
            </Badge>
          )}
          <Badge>{fmtMode(mode)}</Badge>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="text-sm font-medium">Cell colour</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Loss</span>
            {/* Drawn from the same ramp the grid uses, so the key cannot drift from it. */}
            <div className="flex h-2 flex-1 overflow-hidden rounded-full">
              {[-1, -0.6, -0.25, 0, 0.25, 0.6, 1].map((step) => (
                <div
                  key={`heat-${step}`}
                  className="h-full flex-1"
                  style={{ background: heatBackground(step, Math.abs(step)) }}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Gain</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Intensity is the day&apos;s P&amp;L against the largest single day in the statement. The second
            line on each cell is that day against net liquidation value.
          </div>
        </div>

        <Separator />

        <dl>
          <FieldRow
            label={`${activeMonth || 'Month'} P&L`}
            value={monthStats ? fmtSignedMoney(monthStats.sumPnl) : '—'}
            unit={monthStats ? realizedUnit : undefined}
            tone={monthStats ? toneOf(monthStats.sumPnl) : 'neutral'}
          />
          <FieldRow
            label="Share of period"
            value={monthShare !== null ? `${monthShare.toFixed(1)}% of ${fmtMoney(totalCalendarPnl)}` : '—'}
            unit={monthShare !== null ? realizedUnit : undefined}
          />
          <FieldRow label="Statement total" value={fmtSignedMoney(totalCalendarPnl)} unit={realizedUnit} />
          <FieldRow label="Ledger" value={`${transactionsLength.toLocaleString()} transactions`} />
        </dl>
      </div>
    </div>
  );
}
