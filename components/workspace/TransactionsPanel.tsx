'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import TransactionFilters from './TransactionFilters';
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

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* The mobile shell already names the view in its app bar and tab bar. */}
      <div className="hidden lg:block">
        <div className="text-lg font-semibold">Transactions</div>
        <div className="text-sm text-muted-foreground">Filter and tap a row to inspect it.</div>
      </div>
      <div className="space-y-4 flex-1 min-h-0 flex flex-col lg:mt-4">
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible [&>*]:shrink-0">
          <Badge variant="outline">Rows: {filteredTxns.length}</Badge>
          <Badge variant="outline">Total: {fmtMoney(txnSummary.total)}</Badge>
          {(['TRADE', 'DIVIDEND', 'INTEREST', 'WHT', 'FEE'] as const).map((t) => (
            <Badge key={t} variant="secondary">
              {fmtTxnType(t)}: {fmtMoney(txnSummary.byType[t] || 0)}
            </Badge>
          ))}
          {reinvestedTotal > 0 && <Badge variant="outline">Reinvested: {fmtMoney(reinvestedTotal)}</Badge>}
        </div>

        {/* Mobile drives these from the filter sheet in the workspace shell. */}
        <div className="hidden lg:block lg:space-y-4">
          <Separator />
          <TransactionFilters />
          <Separator />
        </div>

        <div className="rounded-xl border overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <div className="text-sm font-medium">Results</div>
            <Badge variant="outline">{filteredTxns.length}</Badge>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-2">
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
                      'w-full text-left rounded-xl border p-3 transition hover:border-foreground/20',
                      isActive ? 'border-foreground/60 bg-muted/40' : 'bg-background',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={typeBadgeVariant(t.type)}>{fmtTxnType(t.type)}</Badge>
                          <Badge variant="outline">{t.currency}</Badge>
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
                              Reinvested: <span className="text-foreground">{fmtMoney(reinvested)}</span>
                              {shareDetail ? ` · ${shareDetail}` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={['font-semibold', amountCls].join(' ')}>
                          {t.amount >= 0 ? '+' : ''}
                          {fmtMoney(t.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {t.realizedPnl !== undefined ? `R: ${fmtMoney(t.realizedPnl)}` : ' '}
                        </div>
                        <div className="text-xs text-muted-foreground">{t.fee !== undefined ? `Fee: ${fmtMoney(t.fee)}` : ' '}</div>
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
