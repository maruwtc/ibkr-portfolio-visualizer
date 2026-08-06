'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useWorkspace } from './WorkspaceContext';
import type { TxnType } from './types';

/**
 * The ledger's search/type/currency/sort controls. Shared so the desktop panel and the
 * mobile filter sheet drive the same state instead of offering two different subsets.
 */
export default function TransactionFilters({ stacked = false }: { stacked?: boolean }) {
  const {
    txnSearch,
    setTxnSearch,
    txnType,
    setTxnType,
    txnCurrency,
    setTxnCurrency,
    txnCurrenciesAvailable,
    txnSort,
    setTxnSort,
  } = useWorkspace();

  return (
    <div className="space-y-4">
      <div className={stacked ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-4 gap-3'}>
        <div className={stacked ? 'space-y-2' : 'md:col-span-2 space-y-2'}>
          <div className="text-sm font-medium">Search</div>
          <Input value={txnSearch} onChange={(e) => setTxnSearch(e.target.value)} placeholder="Symbol / description…" />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Type</div>
          <Select value={txnType} onValueChange={(v) => setTxnType(v as 'ALL' | TxnType)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="TRADE">Trade</SelectItem>
              <SelectItem value="DIVIDEND">Dividend</SelectItem>
              <SelectItem value="INTEREST">Interest</SelectItem>
              <SelectItem value="WHT">Withholding Tax</SelectItem>
              <SelectItem value="FEE">Fee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Currency</div>
          <Select value={txnCurrency} onValueChange={(v) => setTxnCurrency(v)}>
            <SelectTrigger className="w-full">
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
        <Select value={txnSort} onValueChange={(v) => setTxnSort(v as 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC')}>
          <SelectTrigger className={stacked ? 'w-full' : 'max-w-xs'}>
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
    </div>
  );
}
