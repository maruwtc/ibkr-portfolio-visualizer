import type { CashBalance, CurrencyDaily, ParsedStatement, Position, Transaction, TxnType } from '@/components/workspace/types';

/**
 * SnapTrade payloads -> the same `ParsedStatement` the CSV and PDF parsers produce.
 *
 * Everything downstream (calendar, ledger, portfolio) reads that one shape, so the
 * cloud path is a different way of *acquiring* a statement, not a second data model.
 */

type Json = Record<string, any>;

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function optNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = num(v);
  return Number.isFinite(n) ? n : undefined;
}

function isoDate(v: unknown): string {
  const s = String(v ?? '');
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const t = Date.parse(s);
  if (Number.isNaN(t)) return '';
  return new Date(t).toISOString().slice(0, 10);
}

function currencyOf(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v.toUpperCase();
  const o = v as Json;
  return String(o.code ?? o.currency ?? '').toUpperCase();
}

/** SnapTrade nests the instrument one or two levels deep depending on the endpoint. */
function symbolOf(raw: Json | undefined): { ticker: string; description?: string; currency: string } {
  const inner = (raw?.symbol && typeof raw.symbol === 'object' ? raw.symbol : raw) as Json | undefined;
  const deepest = (inner?.symbol && typeof inner.symbol === 'object' ? inner.symbol : inner) as Json | undefined;

  const ticker =
    (typeof inner?.symbol === 'string' ? inner.symbol : undefined) ||
    (typeof deepest?.symbol === 'string' ? deepest.symbol : undefined) ||
    deepest?.raw_symbol ||
    deepest?.ticker ||
    '';

  return {
    ticker: String(ticker || '').toUpperCase(),
    description: deepest?.description || inner?.description || undefined,
    currency: currencyOf(deepest?.currency || inner?.currency),
  };
}

function normalizeType(v: unknown): string {
  return String(v ?? '').toUpperCase().replace(/[^A-Z]/g, '');
}

type Mapped = { type: TxnType; drip?: boolean } | { type: 'SKIP' };

function classify(activity: Json): Mapped {
  const t = normalizeType(activity.type);
  const description = String(activity.description ?? '').toUpperCase();
  const reinvested = t === 'REI' || t === 'DIVIDENDRE' || /REINVEST/.test(description);

  if (t === 'BUY' || t === 'SELL') return { type: 'TRADE', drip: reinvested || undefined };
  if (reinvested) return { type: 'TRADE', drip: true };
  if (t.includes('DIVIDEND')) return { type: 'DIVIDEND' };
  if (t.includes('INTEREST')) return { type: 'INTEREST' };
  if (t.includes('TAX') || /WITHHOLD/.test(description)) return { type: 'WHT' };
  if (t.includes('FEE') || t.includes('COMMISSION')) return { type: 'FEE' };

  // Contributions, withdrawals, transfers and option lifecycle rows move cash or
  // shares without producing P&L; they are counted in the notes instead.
  return { type: 'SKIP' };
}

function sideOf(activity: Json): 'BUY' | 'SELL' | undefined {
  const t = normalizeType(activity.type);
  if (t === 'BUY') return 'BUY';
  if (t === 'SELL') return 'SELL';
  const units = optNum(activity.units);
  if (units === undefined) return undefined;
  return units < 0 ? 'SELL' : 'BUY';
}

export type SnapTradeAccountBundle = {
  account: Json;
  balances: Json[];
  positions: Json[];
  activities: Json[];
};

export function mapAccounts(bundles: SnapTradeAccountBundle[]): ParsedStatement {
  const notes: string[] = [];
  const transactions: Transaction[] = [];
  const positions: Position[] = [];
  const cashBalances: CashBalance[] = [];
  const dailyMap = new Map<string, CurrencyDaily>(); // date|currency

  const accountCurrencies = new Set<string>();
  let skippedActivities = 0;
  let tradeCount = 0;

  for (const bundle of bundles) {
    const accountCurrency =
      currencyOf(bundle.account?.balance?.total?.currency) ||
      currencyOf(bundle.balances?.[0]?.currency) ||
      'USD';
    accountCurrencies.add(accountCurrency);
  }

  // With one account the base is unambiguous; with several the first wins and the
  // mismatch is called out rather than silently converted.
  const baseCurrency = [...accountCurrencies][0] || 'USD';
  if (accountCurrencies.size > 1) {
    notes.push(`Accounts report different currencies (${[...accountCurrencies].join(', ')}). Using ${baseCurrency} as base; no FX applied.`);
  }

  const upsertDaily = (date: string, currency: string): CurrencyDaily => {
    const key = `${date}|${currency}`;
    const existing = dailyMap.get(key);
    if (existing) return existing;

    const fresh: CurrencyDaily = {
      date,
      currency,
      pnl: 0,
      components: { tradesRealized: 0, tradesFees: 0, dividends: 0, interest: 0, withholdingTax: 0 },
    };
    dailyMap.set(key, fresh);
    return fresh;
  };

  for (const bundle of bundles) {
    const account = bundle.account || {};
    const accountId = String(account.id ?? '');
    const accountLabel =
      [account.institution_name, account.name || account.number].filter(Boolean).join(' · ') || accountId || 'Account';
    const accountCurrency =
      currencyOf(account?.balance?.total?.currency) || currencyOf(bundle.balances?.[0]?.currency) || baseCurrency;

    for (const balance of bundle.balances || []) {
      const currency = currencyOf(balance?.currency) || accountCurrency;
      const cash = num(balance?.cash);
      if (!cash) continue;

      const existing = cashBalances.find((c) => c.currency === currency);
      if (existing) {
        existing.valueBase += currency === baseCurrency ? cash : 0;
        existing.value = (existing.value ?? 0) + cash;
      } else {
        cashBalances.push({
          currency,
          valueBase: currency === baseCurrency ? cash : 0,
          value: cash,
        });
      }
    }

    for (const position of bundle.positions || []) {
      const sym = symbolOf(position?.symbol);
      if (!sym.ticker) continue;

      const quantity = num(position?.units ?? position?.fractional_units);
      const price = num(position?.price);
      const currency = sym.currency || accountCurrency;
      const marketValue = quantity * price;
      const average = optNum(position?.average_purchase_price);
      const pnlTotal =
        optNum(position?.open_pnl) ?? (average !== undefined ? (price - average) * quantity : 0);

      positions.push({
        assetClass: position?.symbol?.symbol?.type?.description || 'Stocks',
        symbol: sym.ticker,
        currency,
        quantity,
        price,
        marketValue,
        // SnapTrade quotes no FX rate, so only same-currency holdings can be stated
        // in the base currency. The rest surface as "unconverted" downstream.
        valueBase: currency === baseCurrency ? marketValue : undefined,
        pnlTotal,
        pnlBase: currency === baseCurrency ? pnlTotal : undefined,
      });
    }

    for (const activity of bundle.activities || []) {
      const mapped = classify(activity);
      if (mapped.type === 'SKIP') {
        skippedActivities++;
        continue;
      }

      const date = isoDate(activity?.trade_date || activity?.settlement_date);
      if (!date) {
        skippedActivities++;
        continue;
      }

      const currency = currencyOf(activity?.currency) || accountCurrency;
      const amount = num(activity?.amount);
      const fee = optNum(activity?.fee);
      const sym = symbolOf(activity?.symbol || activity?.option_symbol);
      const description = activity?.description ? String(activity.description) : undefined;

      if (mapped.type === 'TRADE') {
        tradeCount++;
      } else {
        const daily = upsertDaily(date, currency);
        if (mapped.type === 'DIVIDEND') daily.components.dividends += amount;
        if (mapped.type === 'INTEREST') daily.components.interest += amount;
        if (mapped.type === 'WHT') daily.components.withholdingTax += amount;
        if (mapped.type === 'FEE') daily.components.tradesFees += amount;
        daily.pnl += amount;
      }

      const side = mapped.type === 'TRADE' ? sideOf(activity) : undefined;
      const title =
        mapped.type === 'TRADE'
          ? mapped.drip
            ? `${sym.ticker || 'Dividend'} REINVEST`
            : `${sym.ticker || 'Trade'} ${side ?? ''}`.trim()
          : mapped.type === 'DIVIDEND'
            ? `${sym.ticker ? `${sym.ticker} ` : ''}Dividend`
            : mapped.type === 'INTEREST'
              ? 'Interest'
              : mapped.type === 'WHT'
                ? `${sym.ticker ? `${sym.ticker} ` : ''}Withholding Tax`
                : 'Fee';

      transactions.push({
        id: `st-${activity?.id ?? `${accountId}-${date}-${transactions.length}`}`,
        date,
        type: mapped.type,
        currency,
        title,
        description: description || sym.description,
        amount,
        symbol: sym.ticker || undefined,
        side,
        quantity: mapped.type === 'TRADE' ? optNum(activity?.units) : undefined,
        tradePrice: mapped.type === 'TRADE' ? optNum(activity?.price) : undefined,
        proceeds: mapped.type === 'TRADE' ? amount : undefined,
        fee: mapped.type === 'FEE' ? amount : fee,
        drip: mapped.type === 'TRADE' && mapped.drip ? true : undefined,
        raw: {
          type: String(activity?.type ?? ''),
          account: accountLabel,
          settlementDate: String(activity?.settlement_date ?? ''),
          institution: String(activity?.institution ?? account?.institution_name ?? ''),
        },
        sourceFile: accountLabel,
      });
    }
  }

  const navByClass: Record<string, number> = {};

  const stock = positions.reduce((acc, p) => acc + (p.valueBase ?? 0), 0);
  const cash = cashBalances.reduce((acc, c) => acc + c.valueBase, 0);
  if (positions.length) navByClass.stock = stock;
  if (cashBalances.length) navByClass.cash = cash;

  const reportedTotals = bundles
    .map((b) => ({
      amount: optNum(b.account?.balance?.total?.amount),
      currency: currencyOf(b.account?.balance?.total?.currency),
    }))
    .filter((t) => t.amount !== undefined);

  const totalsAreBase = reportedTotals.length > 0 && reportedTotals.every((t) => !t.currency || t.currency === baseCurrency);
  if (totalsAreBase) {
    navByClass.total = reportedTotals.reduce((acc, t) => acc + (t.amount ?? 0), 0);
  } else if (positions.length || cashBalances.length) {
    navByClass.total = stock + cash;
  }

  const unconverted = positions.filter((p) => p.valueBase === undefined).length;
  if (unconverted) {
    notes.push(`${unconverted} holding${unconverted === 1 ? '' : 's'} priced in another currency; excluded from base-currency NAV (SnapTrade supplies no FX rate).`);
  }

  // Same limitation on the cash side, where a zero contribution is otherwise
  // indistinguishable from an empty balance.
  const unconvertedCash = cashBalances.filter((c) => c.currency !== baseCurrency && (c.value ?? 0) !== 0);
  if (unconvertedCash.length) {
    notes.push(
      `Cash in ${unconvertedCash.map((c) => c.currency).join(', ')} is shown in its own currency and excluded from the ${baseCurrency} cash total (no FX rate available).`
    );
  }

  notes.push(
    `Synced ${bundles.length} account${bundles.length === 1 ? '' : 's'}: ${positions.length} holdings, ${transactions.length} activity rows.`
  );
  notes.push(
    'SnapTrade does not report realized P/L per trade: trades appear in the ledger but are excluded from calendar P&L (dividends, interest, withholding and fees are included).'
  );
  if (tradeCount) notes.push(`${tradeCount} trade${tradeCount === 1 ? '' : 's'} carry no realized P/L from the broker feed.`);
  if (skippedActivities) {
    notes.push(`${skippedActivities} non-P&L row${skippedActivities === 1 ? '' : 's'} (transfers, contributions, withdrawals) skipped.`);
  }

  return {
    baseCurrency,
    currencyDaily: [...dailyMap.values()].sort((a, b) =>
      a.date === b.date ? a.currency.localeCompare(b.currency) : a.date.localeCompare(b.date)
    ),
    transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
    navByClass,
    positions,
    cashBalances,
    statementTimestamp: Date.now(),
    notes,
  };
}
