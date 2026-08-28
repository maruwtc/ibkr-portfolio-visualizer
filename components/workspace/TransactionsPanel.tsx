'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import Money from './Money';
import { useWorkspace } from './WorkspaceContext';
import { fmtMoney, fmtShareDetail, fmtTxnType, reinvestedValue, typeBadgeVariant } from './utils';

export default function TransactionsPanel() {
  const {
    filteredTxns,
    txnSummary,
    selectedTxn,
    setSelectedTxn,
  } = useWorkspace();

  // Cash the filtered rows put back into stock through dividend reinvestment.
  const reinvestedTotal = filteredTxns.reduce((acc, t) => acc + (reinvestedValue(t) ?? 0), 0);
  // These are raw sums, so they only carry a currency when the filtered rows agree on
  // one. When they do not there is no unit to print — saying so once beats repeating
  // "mixed" on every badge, and narrowing the Currency filter restores a real unit.
  const summaryUnit = txnSummary.currency ?? '';

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* The mobile shell already names the view in its app bar and tab bar. */}
      <div className="hidden lg:block">
        <div className="text-lg font-semibold">Transactions</div>
        <div className="text-sm text-muted-foreground">Filter from the left column; tap a row to inspect it.</div>
      </div>
      <div className="space-y-4 flex-1 min-h-0 flex flex-col lg:mt-4">
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible [&>*]:shrink-0">
          <Badge variant="outline">Rows: {filteredTxns.length}</Badge>
          <Badge variant="outline">
            Total: {fmtMoney(txnSummary.total)} {summaryUnit}
          </Badge>
          {(['TRADE', 'DIVIDEND', 'INTEREST', 'WHT', 'FEE'] as const).map((t) => (
            <Badge key={t} variant="secondary">
              {fmtTxnType(t)}: {fmtMoney(txnSummary.byType[t] || 0)} {summaryUnit}
            </Badge>
          ))}
          {reinvestedTotal > 0 && (
            <Badge variant="outline">
              Reinvested: {fmtMoney(reinvestedTotal)} {summaryUnit}
            </Badge>
          )}
          {!txnSummary.currency && txnSummary.currencies.length > 1 && (
            <Badge variant="destructive">Totals add {txnSummary.currencies.join(' + ')} — no FX conversion</Badge>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:rounded-xl lg:border">
          <div className="flex items-center justify-between border-b pb-2 lg:p-3">
            <div className="text-sm font-medium">Results</div>
            <Badge variant="outline">{filteredTxns.length}</Badge>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="lg:px-1">
              {filteredTxns.map((t) => {
                const isActive = selectedTxn?.id === t.id;
                const amountCls = t.amount >= 0 ? 'text-emerald-600' : 'text-rose-600';
                const reinvested = reinvestedValue(t);
                const shareDetail = t.drip ? fmtShareDetail(t) : null;

                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTxn(t)}
                    className={[
                      // Rows divide rather than tile: 180 outlined cards inside the
                      // results card is a wall of boxes, and the tint reads selection
                      // more clearly than a border swap did.
                      'w-full border-b border-l-2 border-l-transparent py-3 text-left transition last:border-b-0 hover:bg-muted/40',
                      'lg:px-3',
                      // An accent rule marks the selected row without drawing a box
                      // around it; the transparent border keeps the text from shifting.
                      isActive ? 'border-l-foreground bg-muted' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={typeBadgeVariant(t.type)}>{fmtTxnType(t.type)}</Badge>
                          <Badge variant="outline">{t.date}</Badge>
                          {t.symbol && <Badge variant="secondary">{t.symbol}</Badge>}
                          {t.drip && <Badge variant="outline">DRIP</Badge>}
                        </div>
                        <div className="mt-2 text-sm font-medium">{t.title}</div>
                        {t.description && <div className="text-xs text-muted-foreground mt-1">{t.description}</div>}
                        <div className="mt-2 text-xs text-muted-foreground space-x-2">
                          {t.quantity !== undefined && (
                            <span>
                              Qty: <span className="text-foreground">{t.quantity.toLocaleString()}</span>
                            </span>
                          )}
                          {reinvested !== null && (
                            <span>
                              Reinvested:{' '}
                              <span className="text-foreground">
                                {fmtMoney(reinvested)} {t.currency}
                              </span>
                              {shareDetail ? ` · ${shareDetail}` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={['font-semibold', amountCls].join(' ')}>
                          <Money value={t.amount} unit={t.currency} signed />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t.realizedPnl !== undefined ? `R: ${fmtMoney(t.realizedPnl)} ${t.currency}` : ' '}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.fee !== undefined ? `Fee: ${fmtMoney(t.fee)} ${t.currency}` : ' '}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredTxns.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-12">No results. Try removing filters.</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
