'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

import { useWorkspace } from './WorkspaceContext';
import { fmtMoney, fmtTxnType, typeBadgeVariant } from './utils';

export default function TransactionsPanel() {
  const {
    filteredTxns,
    txnSummary,
    txnSearch,
    setTxnSearch,
    txnType,
    setTxnType,
    txnCurrency,
    setTxnCurrency,
    txnCurrenciesAvailable,
    txnSort,
    setTxnSort,
    selectedTxn,
    setSelectedTxn,
  } = useWorkspace();

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="text-lg font-semibold">Transactions</div>
      <div className="text-sm text-muted-foreground">Filter and click rows. Inspector is on the right panel.</div>
      <div className="mt-4 space-y-4 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">Rows: {filteredTxns.length}</Badge>
          <Badge variant="outline">Total: {fmtMoney(txnSummary.total)}</Badge>
          {(['TRADE', 'DIVIDEND', 'INTEREST', 'WHT'] as const).map((t) => (
            <Badge key={t} variant="secondary">
              {fmtTxnType(t)}: {fmtMoney(txnSummary.byType[t] || 0)}
            </Badge>
          ))}
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 space-y-2">
            <div className="text-sm font-medium">Search</div>
            <Input value={txnSearch} onChange={(e) => setTxnSearch(e.target.value)} placeholder="Symbol / description…" />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Type</div>
            <Select value={txnType} onValueChange={(v) => setTxnType(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="TRADE">Trade</SelectItem>
                <SelectItem value="DIVIDEND">Dividend</SelectItem>
                <SelectItem value="INTEREST">Interest</SelectItem>
                <SelectItem value="WHT">Withholding Tax</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Currency</div>
            <Select value={txnCurrency} onValueChange={(v) => setTxnCurrency(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Currencies</SelectItem>
                {txnCurrenciesAvailable.map((ccy) => (
                  <SelectItem key={ccy} value={ccy}>
                    {ccy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Sort</div>
          <Select value={txnSort} onValueChange={(v) => setTxnSort(v as any)}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DATE_DESC">Date (new → old)</SelectItem>
              <SelectItem value="DATE_ASC">Date (old → new)</SelectItem>
              <SelectItem value="AMOUNT_DESC">Amount (high → low)</SelectItem>
              <SelectItem value="AMOUNT_ASC">Amount (low → high)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

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
                        </div>
                        <div className="mt-2 text-sm font-medium">{t.title}</div>
                        {t.description && <div className="text-xs text-muted-foreground mt-1">{t.description}</div>}
                        <div className="mt-2 text-xs text-muted-foreground space-x-2">
                          {t.quantity !== undefined && (
                            <span>
                              Qty: <span className="text-foreground">{t.quantity.toLocaleString()}</span>
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
