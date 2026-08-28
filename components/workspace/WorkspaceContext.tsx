'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';

import type {
  CashBalance,
  CloudAccount,
  CloudConnection,
  CloudStatus,
  CurrencyDaily,
  DailyPoint,
  MonthStats,
  ParsedStatement,
  Position,
  SourceMode,
  Transaction,
  TxnType,
} from './types';
import { buildMonthGrid, monthKey, safeNum, toISODate } from './utils';
import { readNdjson } from '@/lib/ndjson';
import { extractPdfLines } from './pdf';
import { looksLikeFirstradeStatement, parseFirstradeStatement } from './firstrade';

type WorkspaceMode = 'IBKR_STATEMENT' | 'FIRSTRADE_STATEMENT' | 'IBKR_CLOUD' | 'MIXED' | 'UNKNOWN';

/** One statement handed to the ingestion path, plus the label it should be filed under. */
type IngestEntry = { label: string; statement: ParsedStatement | null; notes?: string[] };

/** One labelled slice of a breakdown, optionally carrying its pre-conversion amount. */
export type AllocationSlice = {
  label: string;
  value: number;
  color: string;
  native?: { value: number; currency: string };
};

type WorkspaceContextValue = {
  rawNames: string[];
  isParsing: boolean;
  parseError: string;
  notes: string[];
  rawPreview: any;

  sourceMode: SourceMode;
  cloudStatus: CloudStatus | null;
  cloudAccounts: CloudAccount[];
  cloudConnections: CloudConnection[];
  cloudBusy: '' | 'sync';
  cloudError: string;
  /** What a running sync is doing right now, for the panel to show while it streams. */
  cloudProgress: string;
  cloudSyncedAt: number | null;

  series: DailyPoint[];
  mode: WorkspaceMode;

  baseCurrency: string;
  currencyDaily: CurrencyDaily[];
  selectedCurrency: string;
  activeMonth: string;

  transactions: Transaction[];
  navByClass: Record<string, number>;
  positions: Position[];
  cashBalances: CashBalance[];

  txnSearch: string;
  txnType: 'ALL' | TxnType;
  txnCurrency: 'ALL' | string;
  txnSort: 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC';
  selectedTxn: Transaction | null;

  chatMessages: { role: 'user' | 'assistant'; content: string }[];
  chatInput: string;
  chatModels: string[];
  chatModel: string;
  chatLoading: boolean;
  chatError: string;
  chatProvider: 'ollama' | 'lmstudio';
  chatProviders: { ollama: boolean; lmstudio: boolean };

  parseFiles: (files: File[]) => Promise<void>;
  pickFiles: () => void;
  clearAll: () => void;
  setSourceMode: (v: SourceMode) => void;
  checkCloudStatus: () => Promise<void>;
  syncCloud: () => Promise<void>;
  sendChat: () => Promise<void>;
  refreshChatModels: () => Promise<void>;
  clearChat: () => void;

  setSelectedCurrency: (v: string) => void;
  setActiveMonth: (v: string) => void;
  setTxnSearch: (v: string) => void;
  setTxnType: (v: 'ALL' | TxnType) => void;
  setTxnCurrency: (v: 'ALL' | string) => void;
  setTxnSort: (v: 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC') => void;
  setSelectedTxn: (v: Transaction | null) => void;
  setChatInput: (v: string) => void;
  setChatModel: (v: string) => void;
  setChatProvider: (v: 'ollama' | 'lmstudio') => void;

  months: string[];
  activeMonthCells: { date: string; day: number; inMonth: boolean; data?: DailyPoint }[];
  maxAbsPnl: number;
  monthStats: MonthStats | null;
  currencies: string[];
  currencyLabel: string;
  /** Currency code the realized figures are actually in, or `mixed`. */
  realizedUnit: string;
  txnCurrenciesAvailable: string[];
  filteredTxns: Transaction[];
  txnSummary: { total: number; byType: Record<TxnType, number>; currency: string | null; currencies: string[] };
  totalCalendarPnl: number;
  portfolioCurve: { date: string; cumulative: number; pnl: number }[];
  portfolioStats: { best: DailyPoint; worst: DailyPoint; avgDaily: number } | null;
  portfolioPeriod: string;
  portfolioMidDate: string;
  portfolioAllocation: { label: string; value: number; color: string }[];
  tradeVolume: number;
  cashComponents: { dividends: number; interest: number; withholding: number; fees: number };
  cashBreakdown: { label: string; value: number; color: string }[];
  cashVsTrade: { label: string; value: number; color: string }[];
  cashByCurrency: { label: string; value: number; color: string }[];
  currentNavTotal: number;
  currentNavCash: number;
  currentNavStock: number;
  currentUnrealized: number;
  holdingsAllocation: AllocationSlice[];
  cashAllocationNow: AllocationSlice[];
  /** Some holding lacked an FX rate, so base-currency totals are approximate. */
  holdingsUnconverted: boolean;
  navComposition: { label: string; value: number; color: string }[];
  navBreakdown: { label: string; value: number; color: string }[];
  chatContext: string;

  parseVersion: number;
};

// Local statements may persist in the browser. Cloud portfolio data is deliberately
// session-only so it cannot survive logout or appear under another Auth0 account.
const LEGACY_STORAGE_KEY = 'ibkr_portfolio_state_v1';
const LOCAL_STORAGE_KEY = 'ibkr_portfolio_local_state_v1';
const SOURCE_MODE_KEY = 'pv_source_mode_v1';

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function looksLikeIBKRStatement(rows: string[][]): boolean {
  const r0 = rows[0] || [];
  return (r0[0] || '').trim() === 'Statement' && (r0[1] || '').trim() === 'Header';
}

function parseTimestamp(input: string): number | null {
  const t = Date.parse(input);
  if (!Number.isNaN(t)) return t;
  const iso = toISODate(input);
  if (!iso) return null;
  const tt = Date.parse(`${iso}T00:00:00`);
  return Number.isNaN(tt) ? null : tt;
}

function parseIBKRStatement(rows: string[][]): ParsedStatement {
  const notes: string[] = [];
  let baseCurrency: string | null = null;
  let statementTimestamp: number | null = null;

  type SectionState = { name: string; header: string[] | null; offset: number };
  let state: SectionState = { name: '', header: null, offset: 2 };

  const dailyMap = new Map<string, CurrencyDaily>();
  const upsertDaily = (date: string, currency: string) => {
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

  const txns: Transaction[] = [];
  const navByClass = new Map<string, number>();
  const positions: Position[] = [];
  /**
   * IBKR emits an `Open Positions` section that carries each holding's own Currency,
   * which the Mark-to-Market summary does not. It is collected separately and, when
   * present, preferred — without a currency there is no way to state a holding in the
   * base currency the rest of the statement is reported in.
   */
  const openPositions: Position[] = [];
  const cashBalances: CashBalance[] = [];
  /** Units of base currency per unit of the keyed currency, read off Forex Balances. */
  const fxToBase = new Map<string, number>();
  const mkId = (prefix: string, i: number) => `${prefix}-${i}-${Math.random().toString(16).slice(2)}`;
  const normalize = (s: string) => (s || '').trim();
  // IBKR's Dividends / Withholding Tax sections carry no Symbol column: the ticker leads
  // the description, e.g. "VTI(US9229087690) Cash Dividend USD 0.505 per Share".
  const symbolFromDescription = (desc: string) => /^([A-Za-z0-9.\-]{1,8})\s*\(/.exec(normalize(desc))?.[1] ?? '';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;

    let section = normalize(row[0]);
    let kind = normalize(row[1]);
    let offset = 2;

    if (section === 'Statement' && (kind === 'Header' || kind === 'Data')) {
      section = normalize(row[2]);
      offset = 3;
    }

    if (section === 'Account Information' && kind === 'Data') {
      const fieldName = (row[offset] || '').trim();
      const fieldValue = (row[offset + 1] || '').trim();
      if (/^Base Currency$/i.test(fieldName)) baseCurrency = fieldValue || null;
    }

    if (section === 'Statement' && kind === 'Data') {
      const fieldName = (row[offset] || '').trim();
      const fieldValue = (row[offset + 1] || '').trim();
      if (/^WhenGenerated$/i.test(fieldName)) {
        const ts = parseTimestamp(fieldValue.replace(' EST', '').replace(' EDT', ''));
        if (ts) statementTimestamp = ts;
      }
    }

    if (kind === 'Header') {
      state = { name: section, header: row.slice(offset).map((x) => (x || '').trim()), offset };
      continue;
    }
    if (kind !== 'Data') continue;

    const header = state.name === section ? state.header : null;
    if (!header) continue;

    const getI = (re: RegExp) => header.findIndex((h) => re.test(h));
    const getByIdx = (idx: number) => (idx >= 0 ? row[state.offset + idx] || '' : '');
    const hasHeader = (re: RegExp) => header.some((h) => re.test(h));

    if (section === 'Trades') {
      const idxCurrency = getI(/^Currency$/i);
      const idxSymbol = getI(/^Symbol$/i);
      const idxDateTime = getI(/^Date\/Time$/i);
      const idxQty = getI(/^Quantity$/i);
      const idxTPrice = getI(/^T\.\s*Price$/i);
      const idxProceeds = getI(/^Proceeds$/i);
      const idxFee = getI(/^Comm\/Fee$/i);
      const idxRealized = getI(/^Realized P\/L$/i);
      const idxCode = getI(/^(Code|Notes\/Codes)$/i);

      const currency = normalize(getByIdx(idxCurrency));
      const iso = toISODate(getByIdx(idxDateTime));
      const symbol = normalize(getByIdx(idxSymbol));

      if (currency && iso) {
        const qty = safeNum(getByIdx(idxQty));
        const tPrice = safeNum(getByIdx(idxTPrice));
        const proceeds = safeNum(getByIdx(idxProceeds));
        const fee = safeNum(getByIdx(idxFee));
        const realized = safeNum(getByIdx(idxRealized));

        const d = upsertDaily(iso, currency);
        d.components.tradesRealized += realized;
        d.components.tradesFees += fee;
        d.pnl += realized + fee;

        const side: 'BUY' | 'SELL' | undefined = qty > 0 ? 'BUY' : qty < 0 ? 'SELL' : undefined;
        const absQty = Math.abs(qty);

        // IBKR flags dividend-reinvestment buys with trade code R (e.g. "O;R").
        const codes = normalize(getByIdx(idxCode)).split(/[;,\s]+/).filter(Boolean);
        const isDrip = codes.includes('R');

        const title = isDrip && symbol ? `${symbol} REINVEST` : symbol ? `${symbol} ${side ?? ''}`.trim() : 'Trade';
        const amount = realized + fee;

        txns.push({
          id: mkId('trade', i),
          date: iso,
          type: 'TRADE',
          currency,
          title,
          description: isDrip ? 'Dividend reinvestment (IBKR code R)' : 'Realized P/L + Fees',
          amount,
          drip: isDrip || undefined,
          symbol: symbol || undefined,
          side,
          quantity: absQty || undefined,
          tradePrice: tPrice || undefined,
          proceeds: proceeds || undefined,
          realizedPnl: realized || undefined,
          fee: fee || undefined,
          raw: Object.fromEntries(header.map((h, j) => [h, row[state.offset + j] ?? ''])),
        });
      }
      continue;
    }

    if (section === 'Dividends') {
      const idxDate = getI(/^Date$/i);
      const idxCurrency = getI(/^Currency$/i);
      const idxSymbol = getI(/^Symbol$/i);
      const idxAmount = getI(/^Amount$/i);

      const idxDescription = getI(/^Description$/i);

      const date = toISODate(getByIdx(idxDate));
      const currency = normalize(getByIdx(idxCurrency));
      const description = normalize(getByIdx(idxDescription));
      const symbol = normalize(getByIdx(idxSymbol)) || symbolFromDescription(description);
      const amount = safeNum(getByIdx(idxAmount));

      if (date && currency) {
        const d = upsertDaily(date, currency);
        d.components.dividends += amount;
        d.pnl += amount;
      }
      if (date) {
        txns.push({
          id: mkId('div', i),
          date,
          type: 'DIVIDEND',
          currency,
          title: symbol ? `${symbol} Dividend` : 'Dividend',
          description,
          amount,
          symbol,
          raw: Object.fromEntries(header.map((h, j) => [h, row[state.offset + j] ?? ''])),
        });
      }
      continue;
    }

    if (section === 'Interest') {
      const idxDate = getI(/^Date$/i);
      const idxCurrency = getI(/^Currency$/i);
      const idxAmount = getI(/^Amount$/i);

      const date = toISODate(getByIdx(idxDate));
      const currency = normalize(getByIdx(idxCurrency));
      const amount = safeNum(getByIdx(idxAmount));

      if (date && currency) {
        const d = upsertDaily(date, currency);
        d.components.interest += amount;
        d.pnl += amount;
      }
      if (date) {
        txns.push({
          id: mkId('interest', i),
          date,
          type: 'INTEREST',
          currency,
          title: 'Interest',
          description: '',
          amount,
          raw: Object.fromEntries(header.map((h, j) => [h, row[state.offset + j] ?? ''])),
        });
      }
      continue;
    }

    if (section === 'Withholding Tax') {
      const idxDate = getI(/^Date$/i);
      const idxCurrency = getI(/^Currency$/i);
      const idxSymbol = getI(/^Symbol$/i);
      const idxAmount = getI(/^Amount$/i);

      const idxDescription = getI(/^Description$/i);

      const date = toISODate(getByIdx(idxDate));
      const currency = normalize(getByIdx(idxCurrency));
      const description = normalize(getByIdx(idxDescription));
      const symbol = normalize(getByIdx(idxSymbol)) || symbolFromDescription(description);
      const amount = safeNum(getByIdx(idxAmount));

      if (date && currency) {
        const d = upsertDaily(date, currency);
        d.components.withholdingTax += amount;
        d.pnl += amount;
      }
      if (date) {
        txns.push({
          id: mkId('wht', i),
          date,
          type: 'WHT',
          currency,
          title: symbol ? `${symbol} Withholding` : 'Withholding Tax',
          description,
          amount,
          symbol,
          raw: Object.fromEntries(header.map((h, j) => [h, row[state.offset + j] ?? ''])),
        });
      }
      continue;
    }

    if (section === 'Statement of Funds' || section === 'Cash Report') {
      const idxDate = getI(/^Date$/i);
      const idxCurrency = getI(/^Currency$/i);
      const idxActivity = getI(/^Activity$/i);
      const idxAmount = getI(/^Amount$/i);

      const date = toISODate(getByIdx(idxDate));
      const currency = normalize(getByIdx(idxCurrency));
      const activity = normalize(getByIdx(idxActivity)).toLowerCase();
      const amount = safeNum(getByIdx(idxAmount));

      if (date && currency) {
        const d = upsertDaily(date, currency);
        if (activity.includes('dividend')) d.components.dividends += amount;
        if (activity.includes('interest')) d.components.interest += amount;
        if (activity.includes('withholding')) d.components.withholdingTax += amount;
        if (activity.includes('fee')) d.components.tradesFees += amount;
        d.pnl += amount;
      }
    }

    if (section === 'Net Asset Value') {
      const idxClass = getI(/^Asset Class$/i);
      const idxDesc = getI(/^Description$/i);
      const idxCurrentTotal = getI(/^Current Total$/i);
      const idxValue = getI(/^Value$/i);

      const label = normalize(getByIdx(idxClass >= 0 ? idxClass : idxDesc));
      const valueBase = safeNum(getByIdx(idxCurrentTotal >= 0 ? idxCurrentTotal : idxValue));
      if (!label || !Number.isFinite(valueBase)) continue;

      if (/Net Liquidation/i.test(label)) navByClass.set('total', valueBase);
      if (/Stock/i.test(label)) navByClass.set('stock', valueBase);
      if (/Cash/i.test(label)) navByClass.set('cash', valueBase);
      if (!/net liquidation|stock|cash/i.test(label)) navByClass.set(label.toLowerCase(), valueBase);
      continue;
    }

    if (section === 'Mark-to-Market Performance Summary') {
      if (hasHeader(/^Asset Category$/i) && hasHeader(/^Symbol$/i)) {
        const idxAsset = getI(/^Asset Category$/i);
        const idxSymbol = getI(/^Symbol$/i);
        const idxQty = getI(/^Current Quantity$/i);
        const idxPrice = getI(/^Current Price$/i);
        const idxPnl = getI(/^Mark-to-Market P\/L Total$/i);

        const assetClass = normalize(getByIdx(idxAsset));
        const symbol = normalize(getByIdx(idxSymbol));
        if (!assetClass || !symbol || /^Total$/i.test(assetClass)) continue;

        const quantity = safeNum(getByIdx(idxQty));
        const price = safeNum(getByIdx(idxPrice));
        const pnlTotal = safeNum(getByIdx(idxPnl));
        const marketValue = quantity * price;

        positions.push({
          assetClass,
          symbol,
          quantity,
          price,
          marketValue,
          pnlTotal,
        });
      } else if (hasHeader(/^Date/i) && hasHeader(/^Currency$/i)) {
        const idxDate = getI(/^Date/i);
        const idxCurrency = getI(/^Currency$/i);
        const idxPnl = getI(/P\/?L/i);
        const date = toISODate(getByIdx(idxDate));
        const currency = normalize(getByIdx(idxCurrency));
        const pnl = safeNum(getByIdx(idxPnl));
        if (date && currency) {
          const d = upsertDaily(date, currency);
          d.pnl += pnl;
        }
      }
      continue;
    }

    if (section === 'Performance Summary by Currency' || section === 'Realized & Unrealized Performance Summary') {
      if (hasHeader(/^Date/i) && hasHeader(/^Currency$/i)) {
        const idxDate = getI(/^Date/i);
        const idxCurrency = getI(/^Currency$/i);
        const idxPnl = getI(/P\/?L/i);
        const date = toISODate(getByIdx(idxDate));
        const currency = normalize(getByIdx(idxCurrency));
        const pnl = safeNum(getByIdx(idxPnl));
        if (date && currency) {
          const d = upsertDaily(date, currency);
          d.pnl += pnl;
        }
      }
      continue;
    }

    if (section === 'Open Positions') {
      // Summary rows are the per-symbol totals; Lot rows repeat the same holding.
      const idxDiscriminator = getI(/^DataDiscriminator$/i);
      const discriminator = normalize(getByIdx(idxDiscriminator));
      if (discriminator && !/^summary$/i.test(discriminator)) continue;

      const idxAsset = getI(/^Asset Category$/i);
      const idxCurrency = getI(/^Currency$/i);
      const idxSymbol = getI(/^Symbol$/i);
      const idxQty = getI(/^Quantity$/i);
      const idxPrice = getI(/^Close Price$/i);
      const idxValue = getI(/^Value$/i);
      const idxPnl = getI(/^Unrealized P\/L$/i);

      const assetClass = normalize(getByIdx(idxAsset));
      const symbol = normalize(getByIdx(idxSymbol));
      if (!symbol || /^total$/i.test(assetClass) || /^total$/i.test(symbol)) continue;

      const quantity = safeNum(getByIdx(idxQty));
      const price = safeNum(getByIdx(idxPrice));
      const marketValue = safeNum(getByIdx(idxValue));

      openPositions.push({
        assetClass,
        symbol,
        currency: normalize(getByIdx(idxCurrency)) || undefined,
        quantity,
        price,
        marketValue: marketValue || quantity * price,
        pnlTotal: safeNum(getByIdx(idxPnl)),
      });
      continue;
    }

    if (section === 'Positions') {
      const idxAsset = getI(/^Asset Class$/i);
      const idxSymbol = getI(/^Symbol$/i);
      const idxQty = getI(/^Position$/i);
      const idxPrice = getI(/^Price$/i);
      const idxMarketValue = getI(/^Market Value$/i);
      const idxPnl = getI(/^Unrealized P\/L$/i);

      const assetClass = normalize(getByIdx(idxAsset));
      const symbol = normalize(getByIdx(idxSymbol));
      const quantity = safeNum(getByIdx(idxQty));
      const price = safeNum(getByIdx(idxPrice));
      const marketValue = safeNum(getByIdx(idxMarketValue));
      const pnlTotal = safeNum(getByIdx(idxPnl));

      if (symbol) {
        positions.push({
          assetClass,
          symbol,
          quantity,
          price,
          marketValue: marketValue || quantity * price,
          pnlTotal,
        });
      }
      continue;
    }

    if (section === 'Forex Balances') {
      // The Currency column here is the statement's base; Description names the
      // currency actually held, and `Value in <base>` is already converted.
      const idxDesc = getI(/^Description$/i);
      const idxCurrency = getI(/^Currency$/i);
      const idxValue = getI(/^Value in/i);
      const idxQty = getI(/^Quantity$/i);
      const label = normalize(getByIdx(idxDesc >= 0 ? idxDesc : idxCurrency));
      if (!label || /^Total$/i.test(label)) continue;
      const valueBase = safeNum(getByIdx(idxValue));
      if (!Number.isFinite(valueBase)) continue;
      const value = safeNum(getByIdx(idxQty));
      cashBalances.push({ currency: label, valueBase, value: value || undefined });
      // Every balance states the same amount twice, once per currency: their ratio is
      // the rate, and it is the only place the statement spells one out.
      if (value) fxToBase.set(label.toUpperCase(), valueBase / value);
      continue;
    }
  }

  // Conversion happens after the sweep: Forex Balances can appear anywhere in the file,
  // so the rate for a holding's currency may not be known while that holding is read.
  if (baseCurrency) fxToBase.set(baseCurrency.toUpperCase(), 1);
  const toBase = (amount: number, currency?: string) => {
    if (!currency) return undefined;
    const rate = fxToBase.get(currency.toUpperCase());
    return rate === undefined ? undefined : amount * rate;
  };

  const resolvedPositions = (openPositions.length ? openPositions : positions).map((p) => ({
    ...p,
    valueBase: toBase(p.marketValue, p.currency),
    pnlBase: toBase(p.pnlTotal, p.currency),
  }));

  return {
    baseCurrency,
    currencyDaily: [...dailyMap.values()].sort((a, b) =>
      a.date === b.date ? a.currency.localeCompare(b.currency) : a.date.localeCompare(b.date)
    ),
    transactions: txns,
    navByClass: Object.fromEntries(navByClass.entries()),
    positions: resolvedPositions,
    cashBalances,
    statementTimestamp,
    notes,
  };
}

function mergeCurrencyDaily(all: CurrencyDaily[]): CurrencyDaily[] {
  const m = new Map<string, CurrencyDaily>(); // key = date|currency

  for (const r of all) {
    const key = `${r.date}|${r.currency}`;
    const existing = m.get(key);

    if (!existing) {
      m.set(key, {
        date: r.date,
        currency: r.currency,
        pnl: r.pnl,
        components: { ...r.components },
      });
      continue;
    }

    existing.pnl += r.pnl;
    existing.components.tradesRealized += r.components.tradesRealized;
    existing.components.tradesFees += r.components.tradesFees;
    existing.components.dividends += r.components.dividends;
    existing.components.interest += r.components.interest;
    existing.components.withholdingTax += r.components.withholdingTax;
  }

  return [...m.values()].sort((a, b) =>
    a.date === b.date ? a.currency.localeCompare(b.currency) : a.date.localeCompare(b.date)
  );
}

function mergeNotes(perFileNotes: { file: string; notes: string[] }[]) {
  const out: string[] = [];
  for (const x of perFileNotes) {
    for (const n of x.notes) out.push(`[${x.file}] ${n}`);
  }
  return out;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [rawNames, setRawNames] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string>('');
  const [notes, setNotes] = useState<string[]>([]);
  const [rawPreview, setRawPreview] = useState<any>(null);

  // Local is the default: nothing is fetched, and no server is required.
  const [sourceMode, setSourceModeState] = useState<SourceMode>('local');
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([]);
  const [cloudConnections, setCloudConnections] = useState<CloudConnection[]>([]);
  const [cloudBusy, setCloudBusy] = useState<'' | 'sync'>('');
  const [cloudError, setCloudError] = useState('');
  const [cloudProgress, setCloudProgress] = useState('');
  const [cloudSyncedAt, setCloudSyncedAt] = useState<number | null>(null);

  const [series, setSeries] = useState<DailyPoint[]>([]);
  const [mode, setMode] = useState<WorkspaceMode>('UNKNOWN');

  const [baseCurrency, setBaseCurrency] = useState<string>('HKD');
  const [currencyDaily, setCurrencyDaily] = useState<CurrencyDaily[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');
  const [activeMonth, setActiveMonth] = useState<string>('');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [navByClass, setNavByClass] = useState<Record<string, number>>({});
  const [positions, setPositions] = useState<Position[]>([]);
  const [cashBalances, setCashBalances] = useState<CashBalance[]>([]);
  const [txnSearch, setTxnSearch] = useState('');
  const [txnType, setTxnType] = useState<'ALL' | TxnType>('ALL');
  const [txnCurrency, setTxnCurrency] = useState<'ALL' | string>('ALL');
  const [txnSort, setTxnSort] = useState<'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>('DATE_DESC');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatModels, setChatModels] = useState<string[]>([]);
  const [chatModel, setChatModel] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatProvider, setChatProvider] = useState<'ollama' | 'lmstudio'>('ollama');
  const [chatProviders, setChatProviders] = useState<{ ollama: boolean; lmstudio: boolean }>({ ollama: false, lmstudio: false });

  const [isHydrated, setIsHydrated] = useState(false);
  const [parseVersion, setParseVersion] = useState(0);

  const rebuildSeriesFromCurrencyDaily = useCallback((ccyDaily: CurrencyDaily[], baseCcy: string, selection: string) => {
    const byDate = new Map<string, number>();

    for (const r of ccyDaily) {
      const include =
        selection === 'ALL'
          ? true
          : selection === 'BASE'
            ? r.currency === baseCcy
            : r.currency === selection;

      if (!include) continue;
      byDate.set(r.date, (byDate.get(r.date) || 0) + r.pnl);
    }

    const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const s: DailyPoint[] = sorted.map(([date, pnl]) => ({ date, pnl }));
    setSeries(s);
    setActiveMonth(s.length ? monthKey(s[s.length - 1].date) : '');
  }, []);

  /** Clears whatever a previous load put on screen, before a new one lands. */
  const resetIngestState = useCallback(() => {
    setParseError('');
    setNotes([]);
    setMode('UNKNOWN');
    setSeries([]);
    setCurrencyDaily([]);
    setTransactions([]);
    setNavByClass({});
    setPositions([]);
    setCashBalances([]);
    setRawPreview(null);
    setSelectedTxn(null);
  }, []);

  /**
   * The single point where statements become workspace state.
   *
   * Uploads and cloud syncs differ only in how they obtain a `ParsedStatement`;
   * merging, base-currency reconciliation and note collection are shared here so the
   * two source modes cannot drift apart.
   */
  const applyStatements = useCallback(
    (entries: IngestEntry[], detectedMode: WorkspaceMode, emptyError: string): boolean => {
      const allCurrencyDaily: CurrencyDaily[] = [];
      const allTxns: Transaction[] = [];
      let bestState: {
        ts: number;
        navByClass: Record<string, number>;
        positions: Position[];
        cashBalances: CashBalance[];
      } | null = null;
      const perFileNotes: { file: string; notes: string[] }[] = [];

      let detectedBaseCurrency: string | null = null;
      const baseCurrencySet = new Set<string>();

      for (const entry of entries) {
        const out = entry.statement;

        if (!out) {
          if (entry.notes?.length) perFileNotes.push({ file: entry.label, notes: entry.notes });
          continue;
        }

        if (out.baseCurrency) {
          baseCurrencySet.add(out.baseCurrency);
          if (!detectedBaseCurrency) detectedBaseCurrency = out.baseCurrency;
        }

        allCurrencyDaily.push(...out.currencyDaily);

        // A cloud sync labels rows by account; only files need the label applied here.
        allTxns.push(...out.transactions.map((t) => ({ ...t, sourceFile: t.sourceFile ?? entry.label })));

        perFileNotes.push({ file: entry.label, notes: [...(entry.notes ?? []), ...out.notes] });

        const ts = out.statementTimestamp ?? 0;
        if (!bestState || ts > bestState.ts) {
          bestState = {
            ts,
            navByClass: out.navByClass,
            positions: out.positions,
            cashBalances: out.cashBalances,
          };
        }
      }

      const hasState =
        !!bestState &&
        (Object.keys(bestState.navByClass || {}).length > 0 || bestState.positions.length > 0 || bestState.cashBalances.length > 0);
      if (!allCurrencyDaily.length && !allTxns.length && !hasState) {
        setParseError(emptyError);
        return false;
      }

      setMode(detectedMode);

      if (detectedBaseCurrency) {
        setBaseCurrency(detectedBaseCurrency);
      }
      if (baseCurrencySet.size > 1) {
        perFileNotes.unshift({
          file: 'MERGE',
          notes: [`Multiple Base Currencies detected: ${[...baseCurrencySet].join(', ')}. Using: ${detectedBaseCurrency ?? baseCurrency}`],
        });
      }

      const mergedDaily = mergeCurrencyDaily(allCurrencyDaily);
      setCurrencyDaily(mergedDaily);

      const mergedTxns = [...allTxns].sort((a, b) => b.date.localeCompare(a.date));
      setTransactions(mergedTxns);

      if (bestState) {
        setNavByClass(bestState.navByClass);
        setPositions(bestState.positions);
        setCashBalances(bestState.cashBalances);
      }

      const base = detectedBaseCurrency || baseCurrency;
      setSelectedCurrency('ALL');
      rebuildSeriesFromCurrencyDaily(mergedDaily, base, 'ALL');

      setNotes(mergeNotes(perFileNotes));
      setParseVersion((v) => v + 1);

      return true;
    },
    [baseCurrency, rebuildSeriesFromCurrencyDaily]
  );

  const parseFiles = useCallback(
    async (files: File[]) => {
      const list = (files || []).filter(Boolean);
      if (!list.length) return;

      setRawNames(list.map((f) => f.name));
      setIsParsing(true);
      resetIngestState();

      try {
        const entries: IngestEntry[] = [];
        let previewSet = false;
        const detectedModes = new Set<WorkspaceMode>();

        for (const file of list) {
          let out: ParsedStatement | null = null;
          let preview: string[][] | null = null;

          if (isPdfFile(file)) {
            const lines = await extractPdfLines(file);

            if (!lines.length) {
              entries.push({
                label: file.name,
                statement: null,
                notes: ['PDF has no extractable text (scanned image?). Skipped.'],
              });
              continue;
            }

            if (!looksLikeFirstradeStatement(lines)) {
              entries.push({
                label: file.name,
                statement: null,
                notes: ['Not a recognized Firstrade PDF statement. Skipped.'],
              });
              continue;
            }

            out = parseFirstradeStatement(lines);
            preview = lines.map((l) => [l]);
            detectedModes.add('FIRSTRADE_STATEMENT');
          } else {
            const text = await file.text();
            const raw = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true, dynamicTyping: false });

            const rows = (raw.data || []).map((r) => (r || []).map((x) => String(x ?? '')));

            if (!rows.length) {
              entries.push({ label: file.name, statement: null, notes: ['CSV has no rows.'] });
              continue;
            }

            if (!looksLikeIBKRStatement(rows)) {
              entries.push({
                label: file.name,
                statement: null,
                notes: ['Not IBKR Activity Statement CSV (Statement/Header/Data). Skipped.'],
              });
              continue;
            }

            out = parseIBKRStatement(rows);
            preview = rows;
            detectedModes.add('IBKR_STATEMENT');
          }

          entries.push({ label: file.name, statement: out });

          if (!previewSet && preview) {
            setRawPreview(preview.slice(0, 120));
            previewSet = true;
          }
        }

        applyStatements(
          entries,
          detectedModes.size > 1 ? 'MIXED' : ([...detectedModes][0] ?? 'UNKNOWN'),
          'No valid IBKR (CSV) or Firstrade (PDF) statement data found in the selected files.'
        );

        setIsParsing(false);
      } catch (e: any) {
        setIsParsing(false);
        setParseError(`Failed to read/parse files: ${e?.message || String(e)}`);
      }
    },
    [applyStatements, resetIngestState]
  );

  const pickFiles = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,.pdf,application/pdf';
    input.multiple = true;
    input.onchange = () => {
      const fs = Array.from(input.files || []);
      if (fs.length) parseFiles(fs);
    };
    input.click();
  }, [parseFiles]);

  const resetWorkspace = useCallback(() => {
    setRawNames([]);
    setIsParsing(false);
    setParseError('');
    setNotes([]);
    setRawPreview(null);
    setSeries([]);
    setMode('UNKNOWN');
    setCurrencyDaily([]);
    setTransactions([]);
    setNavByClass({});
    setPositions([]);
    setCashBalances([]);
    setActiveMonth('');
    setSelectedCurrency('ALL');

    setTxnSearch('');
    setTxnType('ALL');
    setTxnCurrency('ALL');
    setTxnSort('DATE_DESC');
    setSelectedTxn(null);
    setChatMessages([]);
    setChatInput('');
    setChatError('');
  }, []);

  const clearAll = useCallback(() => {
    resetWorkspace();
    if (sourceMode === 'local' && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
    }
  }, [resetWorkspace, sourceMode]);

  const checkCloudStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/cloud/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const authenticated = !!data?.authenticated;
      setCloudStatus({
        provider: typeof data?.provider === 'string' ? data.provider : 'snaptrade',
        available: !!data?.available,
        reason: typeof data?.reason === 'string' ? data.reason : null,
        authenticated,
        configured: !!data?.configured,
        authEnabled: !!data?.authEnabled,
        databaseEnabled: !!data?.databaseEnabled,
        maskedClientId: typeof data?.maskedClientId === 'string' ? data.maskedClientId : null,
        credentialUpdatedAt: typeof data?.credentialUpdatedAt === 'string' ? data.credentialUpdatedAt : null,
        user:
          data?.user && typeof data.user === 'object'
            ? {
                name: typeof data.user.name === 'string' ? data.user.name : null,
                email: typeof data.user.email === 'string' ? data.user.email : null,
              }
            : null,
      });
      if (!authenticated) {
        setCloudAccounts([]);
        setCloudConnections([]);
        setCloudSyncedAt(null);
        if (sourceMode === 'cloud') resetWorkspace();
      }
    } catch {
      // A statically exported build serves no API routes at all, and that failure is
      // itself the answer: this deployment cannot reach a broker.
      setCloudStatus({
        provider: 'snaptrade',
        available: false,
        reason: 'This build serves no API routes, so cloud sync is unavailable here. Run the app on a Node server to enable it.',
        authenticated: false,
        configured: false,
        authEnabled: false,
        databaseEnabled: false,
        maskedClientId: null,
        credentialUpdatedAt: null,
        user: null,
      });
    }
  }, [resetWorkspace, sourceMode]);

  const restoreLocalWorkspace = useCallback(() => {
    resetWorkspace();
    if (typeof window === 'undefined') return;

    try {
      const current = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      const legacy = current ? null : window.localStorage.getItem(LEGACY_STORAGE_KEY);
      const raw = current || legacy;
      if (!raw) return;

      const data = JSON.parse(raw);
      // The old shared key may contain a cloud snapshot. Never migrate that into Local.
      if (!data || data.v !== 1 || data.mode === 'IBKR_CLOUD') {
        if (legacy) window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        return;
      }

      setRawNames(Array.isArray(data.rawNames) ? data.rawNames : []);
      setSeries(Array.isArray(data.series) ? data.series : []);
      setCurrencyDaily(Array.isArray(data.currencyDaily) ? data.currencyDaily : []);
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      setNavByClass(typeof data.navByClass === 'object' && data.navByClass ? data.navByClass : {});
      setPositions(Array.isArray(data.positions) ? data.positions : []);
      setCashBalances(Array.isArray(data.cashBalances) ? data.cashBalances : []);
      setNotes(Array.isArray(data.notes) ? data.notes : []);
      setRawPreview(data.rawPreview ?? null);
      setBaseCurrency(typeof data.baseCurrency === 'string' ? data.baseCurrency : 'HKD');
      setSelectedCurrency(typeof data.selectedCurrency === 'string' ? data.selectedCurrency : 'ALL');
      setMode(typeof data.mode === 'string' ? data.mode : 'UNKNOWN');
      setActiveMonth(
        typeof data.activeMonth === 'string'
          ? data.activeMonth
          : Array.isArray(data.series) && data.series.length
            ? monthKey(data.series[data.series.length - 1].date)
            : ''
      );

      if (legacy) {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, raw);
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    } catch {
      // Ignore malformed or unavailable browser storage.
    }
  }, [resetWorkspace]);

  const setSourceMode = useCallback(
    (v: SourceMode) => {
      if (v === sourceMode) {
        if (v === 'cloud') checkCloudStatus();
        return;
      }
      setSourceModeState(v);
      setCloudError('');
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(SOURCE_MODE_KEY, v);
        } catch {
          // ignore storage errors
        }
      }
      setCloudAccounts([]);
      setCloudConnections([]);
      setCloudSyncedAt(null);
      if (v === 'local') restoreLocalWorkspace();
      else {
        resetWorkspace();
        checkCloudStatus();
      }
    },
    [checkCloudStatus, resetWorkspace, restoreLocalWorkspace, sourceMode]
  );

  /**
   * Reads the sync as a stream instead of one response.
   *
   * The server sends complete statement snapshots as they become available —
   * holdings first, then activity as its pages land — so the workspace is drawn and
   * usable while the rest of the history is still downloading. Each snapshot stands on
   * its own, so applying the newest is enough; there are no deltas to merge.
   */
  const syncCloud = useCallback(async () => {
    setCloudBusy('sync');
    setCloudError('');
    setCloudProgress('Connecting…');
    setIsParsing(true);

    let applied = false;
    let streamError = '';

    const handle = (event: any) => {
      if (event?.kind === 'meta') {
        const accounts: CloudAccount[] = Array.isArray(event.accounts) ? event.accounts : [];
        setCloudAccounts(accounts);
        setCloudConnections(Array.isArray(event.connections) ? event.connections : []);
        setRawNames(accounts.map((a) => [a.institution, a.name].filter(Boolean).join(' · ') || a.id));
        setCloudProgress(accounts.length ? 'Loading holdings…' : '');
        return;
      }

      if (event?.kind === 'stage') {
        setCloudProgress(
          event.stage === 'holdings'
            ? 'Loading activity…'
            : `Loaded ${Number(event.count || 0).toLocaleString()} activity rows…`
        );
        return;
      }

      if (event?.kind === 'statement') {
        if (!applied) resetIngestState();
        applied = true;
        applyStatements(
          [{ label: 'SnapTrade', statement: event.statement as ParsedStatement }],
          'IBKR_CLOUD',
          'The connected account returned no positions or activity.'
        );
        // Holdings are enough to work with; the rest arrives behind an open page.
        setIsParsing(false);
        return;
      }

      if (event?.kind === 'error') {
        streamError = String(event.message || 'Cloud sync failed');
        return;
      }

      if (event?.kind === 'done') {
        setCloudSyncedAt(typeof event.syncedAt === 'number' ? event.syncedAt : Date.now());
      }
    };

    try {
      const res = await fetch('/api/cloud/snaptrade/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Anything that fails before the stream opens still answers as plain JSON.
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Sync failed (${res.status})`);
      }

      await readNdjson(res.body, handle);

      // A failure after holdings landed is a partial sync, not a failed one.
      if (streamError && !applied) throw new Error(streamError);
      if (streamError) setCloudError(streamError);
    } catch (e: any) {
      setCloudError(e?.message || 'Cloud sync failed');
    } finally {
      setCloudBusy('');
      setCloudProgress('');
      setIsParsing(false);
    }
  }, [applyStatements, resetIngestState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedMode = window.localStorage.getItem(SOURCE_MODE_KEY);
      const initialMode: SourceMode = storedMode === 'cloud' ? 'cloud' : 'local';
      setSourceModeState(initialMode);

      // Remove browser credentials and cloud metadata left by the pre-Auth0 version.
      window.localStorage.removeItem('pv_cloud_session_v1');
      window.localStorage.removeItem('pv_cloud_cache_v1');

      if (initialMode === 'local') restoreLocalWorkspace();
      else resetWorkspace();
    } catch {
      // ignore storage errors
    } finally {
      setIsHydrated(true);
    }
  }, [resetWorkspace, restoreLocalWorkspace]);

  // Covers the reload that comes back up already in cloud mode.
  useEffect(() => {
    if (sourceMode === 'cloud' && !cloudStatus) checkCloudStatus();
  }, [checkCloudStatus, cloudStatus, sourceMode]);

  useEffect(() => {
    if (!isHydrated || sourceMode !== 'local' || typeof window === 'undefined') return;
    const payload = {
      v: 1,
      rawNames,
      series,
      currencyDaily,
      transactions,
      navByClass,
      positions,
      cashBalances,
      notes,
      rawPreview,
      baseCurrency,
      selectedCurrency,
      activeMonth,
      mode,
    };
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }, [activeMonth, baseCurrency, cashBalances, currencyDaily, isHydrated, mode, navByClass, notes, positions, rawNames, rawPreview, selectedCurrency, series, sourceMode, transactions]);

  const fetchChatModels = useCallback(async () => {
    try {
      setChatError('');
      const res = await fetch(`/api/llm/models?provider=${chatProvider}`);
      if (!res.ok) throw new Error(`Model list failed (${res.status})`);
      const data = await res.json();
      const models = Array.isArray(data.models) ? data.models : [];
      setChatModels(models);
      if (models.length && (!chatModel || !models.includes(chatModel))) {
        setChatModel(models[0]);
      }
    } catch (e: any) {
      setChatError(e?.message || 'Failed to load models');
    }
  }, [chatModel, chatProvider]);

  const fetchChatProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/llm/providers');
      if (!res.ok) throw new Error(`Provider check failed (${res.status})`);
      const data = await res.json();
      const ollama = !!data?.ollama;
      const lmstudio = !!data?.lmstudio;
      setChatProviders({ ollama, lmstudio });
      if (lmstudio) setChatProvider('lmstudio');
      else if (ollama) setChatProvider('ollama');
    } catch (e: any) {
      setChatError(e?.message || 'Failed to detect providers');
    }
  }, []);

  useEffect(() => {
    fetchChatProviders();
  }, [fetchChatProviders]);

  useEffect(() => {
    fetchChatModels();
  }, [fetchChatModels, chatProvider]);

  const dailyMap = useMemo(() => {
    const m = new Map<string, DailyPoint>();
    for (const p of series) m.set(p.date, p);
    return m;
  }, [series]);

  const months = useMemo(() => {
    const s = new Set<string>();
    for (const p of series) s.add(monthKey(p.date));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [series]);

  const activeMonthCells = useMemo(() => {
    if (!activeMonth) return [];
    const [yStr, mStr] = activeMonth.split('-');
    const y = Number(yStr);
    const m0 = Number(mStr) - 1;
    if (!Number.isFinite(y) || !Number.isFinite(m0)) return [];
    return buildMonthGrid(y, m0, dailyMap);
  }, [activeMonth, dailyMap]);

  const maxAbsPnl = useMemo(() => {
    const monthSet = new Set(activeMonthCells.filter((c) => c.inMonth).map((c) => c.date));
    const pnls = series.filter((p) => monthSet.has(p.date)).map((p) => p.pnl);
    return pnls.reduce((acc, v) => Math.max(acc, Math.abs(v)), 0);
  }, [activeMonthCells, series]);

  const monthStats = useMemo<MonthStats | null>(() => {
    if (!activeMonth) return null;
    const pts = series.filter((p) => monthKey(p.date) === activeMonth);
    if (!pts.length) return null;

    const sumPnl = pts.reduce((a, p) => a + p.pnl, 0);
    const best = pts.reduce((a, p) => (p.pnl > a.pnl ? p : a), pts[0]);
    const worst = pts.reduce((a, p) => (p.pnl < a.pnl ? p : a), pts[0]);
    const winDays = pts.filter((p) => p.pnl > 0).length;

    return { days: pts.length, sumPnl, winDays, best, worst };
  }, [activeMonth, series]);

  const currencies = useMemo(() => {
    const s = new Set<string>();
    for (const r of currencyDaily) s.add(r.currency);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [currencyDaily]);

  const currencyLabel = useMemo(() => {
    if (mode === 'UNKNOWN') return '';
    if (selectedCurrency === 'BASE') return `Base (${baseCurrency})`;
    if (selectedCurrency === 'ALL') return 'ALL (no FX)';
    return selectedCurrency;
  }, [mode, selectedCurrency, baseCurrency]);

  /**
   * The unit to print beside a realized figure.
   *
   * `currencyLabel` names the *view*; this names what the numbers under that view
   * actually are. Under ALL they are a sum across whichever currencies the statement
   * booked in — frequently just one, in which case that code is both shorter and more
   * precise than "ALL (no FX)". Only a genuine mix has no unit to give.
   */
  const realizedUnit = useMemo(() => {
    if (mode === 'UNKNOWN') return '';
    if (selectedCurrency === 'BASE') return baseCurrency;
    if (selectedCurrency !== 'ALL') return selectedCurrency;
    const seen = new Set(currencyDaily.filter((r) => r.pnl !== 0).map((r) => r.currency));
    return seen.size === 1 ? [...seen][0] : 'mixed';
  }, [mode, selectedCurrency, baseCurrency, currencyDaily]);

  useEffect(() => {
    if (mode === 'UNKNOWN') return;
    rebuildSeriesFromCurrencyDaily(currencyDaily, baseCurrency, selectedCurrency);
  }, [mode, currencyDaily, baseCurrency, selectedCurrency, rebuildSeriesFromCurrencyDaily]);

  const txnCurrenciesAvailable = useMemo(() => {
    const s = new Set<string>();
    for (const t of transactions) s.add(t.currency);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const filteredTxns = useMemo(() => {
    const q = txnSearch.trim().toLowerCase();

    let list = transactions.filter((t) => {
      if (txnType !== 'ALL' && t.type !== txnType) return false;
      if (txnCurrency !== 'ALL' && t.currency !== txnCurrency) return false;
      if (!q) return true;
      const target = [t.symbol, t.title, t.description].filter(Boolean).join(' ').toLowerCase();
      return target.includes(q);
    });

    list = list.slice().sort((a, b) => {
      if (txnSort === 'DATE_ASC') return a.date.localeCompare(b.date);
      if (txnSort === 'DATE_DESC') return b.date.localeCompare(a.date);
      if (txnSort === 'AMOUNT_ASC') return a.amount - b.amount;
      if (txnSort === 'AMOUNT_DESC') return b.amount - a.amount;
      return 0;
    });

    return list;
  }, [transactions, txnCurrency, txnSearch, txnSort, txnType]);

  const txnSummary = useMemo(() => {
    const total = filteredTxns.reduce((a, t) => a + t.amount, 0);
    const byType = filteredTxns.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + t.amount;
      return acc;
    }, {} as Record<TxnType, number>);

    // These totals add raw amounts, so they only denote a currency when every filtered
    // row shares one. Otherwise the sum has no single unit and must say so.
    const seen = [...new Set(filteredTxns.map((t) => t.currency).filter(Boolean))].sort();
    const currency = seen.length === 1 ? seen[0] : null;

    return { total, byType, currency, currencies: seen };
  }, [filteredTxns]);

  useEffect(() => {
    if (!selectedTxn) return;
    const stillExists = filteredTxns.some((t) => t.id === selectedTxn.id);
    if (!stillExists) setSelectedTxn(null);
  }, [filteredTxns, selectedTxn]);

  const totalCalendarPnl = useMemo(() => series.reduce((a, p) => a + p.pnl, 0), [series]);
  const portfolioCurve = useMemo(() => {
    let acc = 0;
    return series.map((p) => {
      acc += p.pnl;
      return { date: p.date, cumulative: acc, pnl: p.pnl };
    });
  }, [series]);
  const portfolioStats = useMemo(() => {
    if (!series.length) return null;
    const best = series.reduce((a, b) => (b.pnl > a.pnl ? b : a), series[0]);
    const worst = series.reduce((a, b) => (b.pnl < a.pnl ? b : a), series[0]);
    const avgDaily = totalCalendarPnl / series.length;
    return { best, worst, avgDaily };
  }, [series, totalCalendarPnl]);
  const portfolioPeriod = series.length ? `${series[0].date} → ${series[series.length - 1].date}` : '—';
  const portfolioMidDate = series.length ? series[Math.floor(series.length / 2)].date : '';
  const portfolioAllocation = useMemo(() => {
    const bySymbol = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'TRADE') continue;
      const label = t.symbol || 'Unknown';
      bySymbol.set(label, (bySymbol.get(label) || 0) + Math.abs(t.amount));
    }
    const sorted = [...bySymbol.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const palette = [
      'var(--chart-1)',
      'var(--chart-2)',
      'var(--chart-3)',
      'var(--chart-4)',
      'var(--chart-5)',
      'hsl(210 60% 55%)',
      'hsl(32 85% 55%)',
      'hsl(330 65% 58%)',
    ];
    return sorted.map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
  }, [transactions]);
  const tradeVolume = useMemo(() => {
    return transactions.reduce((acc, t) => (t.type === 'TRADE' ? acc + Math.abs(t.amount) : acc), 0);
  }, [transactions]);
  const cashComponents = useMemo(() => {
    let dividends = 0;
    let interest = 0;
    let withholding = 0;
    let fees = 0;
    for (const r of currencyDaily) {
      dividends += Math.abs(r.components.dividends);
      interest += Math.abs(r.components.interest);
      withholding += Math.abs(r.components.withholdingTax);
      fees += Math.abs(r.components.tradesFees);
    }
    return { dividends, interest, withholding, fees };
  }, [currencyDaily]);
  const cashBreakdown = useMemo(() => {
    const palette = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];
    const items = [
      { label: 'Dividends', value: cashComponents.dividends, color: palette[0] },
      { label: 'Interest', value: cashComponents.interest, color: palette[1] },
      { label: 'Withholding', value: cashComponents.withholding, color: palette[2] },
      { label: 'Fees', value: cashComponents.fees, color: palette[3] },
    ];
    return items.filter((x) => x.value > 0);
  }, [cashComponents]);
  const cashVsTrade = useMemo(() => {
    const cashTotal = cashComponents.dividends + cashComponents.interest + cashComponents.withholding + cashComponents.fees;
    return [
      { label: 'Trades', value: tradeVolume, color: 'var(--chart-2)' },
      { label: 'Cash', value: cashTotal, color: 'var(--chart-4)' },
    ];
  }, [cashComponents, tradeVolume]);
  const cashByCurrency = useMemo(() => {
    const byCcy = new Map<string, number>();
    for (const r of currencyDaily) {
      const cash = Math.abs(r.components.dividends) + Math.abs(r.components.interest) + Math.abs(r.components.withholdingTax) + Math.abs(r.components.tradesFees);
      if (cash === 0) continue;
      byCcy.set(r.currency, (byCcy.get(r.currency) || 0) + cash);
    }
    const sorted = [...byCcy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const palette = [
      'var(--chart-1)',
      'var(--chart-2)',
      'var(--chart-3)',
      'var(--chart-4)',
      'var(--chart-5)',
      'hsl(330 65% 58%)',
    ];
    return sorted.map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
  }, [currencyDaily]);
  const currentNavTotal = navByClass.total ?? 0;
  const currentNavCash = navByClass.cash ?? 0;
  const currentNavStock = navByClass.stock ?? 0;
  // Holdings are reported in each instrument's own currency, while net asset value is
  // reported in the base currency. Everything the overview shows is stated in base, so
  // the converted figure is the one to use — falling back to the native amount only
  // when the statement gave no rate to convert with.
  const currentUnrealized = useMemo(
    () => positions.reduce((acc, p) => acc + (p.pnlBase ?? p.pnlTotal), 0),
    [positions]
  );

  /** True when some holding could not be converted, so totals mix currencies. */
  const holdingsUnconverted = useMemo(
    () => positions.some((p) => /stocks?/i.test(p.assetClass) && p.marketValue !== 0 && p.valueBase === undefined),
    [positions]
  );

  const holdingsAllocation = useMemo(() => {
    const bySymbol = new Map<string, { base: number; native: number; currency?: string }>();
    for (const p of positions) {
      if (!/stocks?/i.test(p.assetClass)) continue;
      const base = Math.abs(p.valueBase ?? p.marketValue);
      if (!base) continue;
      const prev = bySymbol.get(p.symbol);
      bySymbol.set(p.symbol, {
        base: (prev?.base || 0) + base,
        native: (prev?.native || 0) + Math.abs(p.marketValue),
        currency: p.currency,
      });
    }
    const sorted = [...bySymbol.entries()].sort((a, b) => b[1].base - a[1].base).slice(0, 8);
    const palette = [
      'var(--chart-1)',
      'var(--chart-2)',
      'var(--chart-3)',
      'var(--chart-4)',
      'var(--chart-5)',
      'hsl(210 60% 55%)',
      'hsl(32 85% 55%)',
      'hsl(330 65% 58%)',
    ];
    return sorted.map(([label, v], i) => ({
      label,
      value: v.base,
      color: palette[i % palette.length],
      // Only worth showing when it is a different number from the one on the row.
      native: v.currency && v.base !== v.native ? { value: v.native, currency: v.currency } : undefined,
    }));
  }, [positions]);
  const cashAllocationNow = useMemo(() => {
    const sorted = [...cashBalances]
      .filter((c) => Math.abs(c.valueBase) > 0)
      .sort((a, b) => Math.abs(b.valueBase) - Math.abs(a.valueBase))
      .slice(0, 6);
    const palette = [
      'var(--chart-1)',
      'var(--chart-2)',
      'var(--chart-3)',
      'var(--chart-4)',
      'var(--chart-5)',
      'hsl(330 65% 58%)',
    ];
    return sorted.map((c, i) => ({
      label: c.currency,
      value: Math.abs(c.valueBase),
      color: palette[i % palette.length],
      native:
        c.value !== undefined && Math.abs(c.value) !== Math.abs(c.valueBase)
          ? { value: Math.abs(c.value), currency: c.currency }
          : undefined,
    }));
  }, [cashBalances]);

  const NAV_STOCK_COLOR = 'var(--chart-1)';
  const NAV_CASH_COLOR = 'var(--chart-2)';
  const NAV_OTHER_COLOR = 'var(--chart-3)';

  /** Every NAV entry that is neither the total nor the stock/cash buckets. */
  const navOtherClasses = useMemo(
    () => Object.entries(navByClass).filter(([key]) => key !== 'total' && key !== 'stock' && key !== 'cash'),
    [navByClass]
  );

  const navComposition = useMemo(() => {
    const explicitOthers = navOtherClasses.reduce((acc, [, v]) => acc + v, 0);
    // Prefer the residual against reported NAV — it also covers asset classes the
    // statement reported only inside the total.
    const others = currentNavTotal ? currentNavTotal - currentNavStock - currentNavCash : explicitOthers;

    return [
      { label: 'Stock', value: currentNavStock, color: NAV_STOCK_COLOR },
      { label: 'Cash', value: currentNavCash, color: NAV_CASH_COLOR },
      { label: 'Others', value: others, color: NAV_OTHER_COLOR },
    ]
      // The pie can only draw magnitudes; the breakdown list carries the real signs
      // (cash goes negative on a margin debit).
      .map((slice) => ({ ...slice, value: Math.abs(slice.value) }))
      .filter((slice) => slice.value > 0.005);
  }, [currentNavCash, currentNavStock, currentNavTotal, navOtherClasses]);

  const navBreakdown = useMemo(() => {
    // Everything outside stock/cash carries the Others colour, so this list reads as
    // the legend of the three-slice composition chart.
    const rows = [
      { label: 'Stock', value: currentNavStock, color: NAV_STOCK_COLOR },
      { label: 'Cash', value: currentNavCash, color: NAV_CASH_COLOR },
      ...navOtherClasses.map(([key, value]) => ({
        label: key.replace(/\b\w/g, (c) => c.toUpperCase()),
        value,
        color: NAV_OTHER_COLOR,
      })),
    ];

    const residual = currentNavTotal
      ? currentNavTotal - rows.reduce((acc, r) => acc + r.value, 0)
      : 0;
    if (Math.abs(residual) > 0.005) rows.push({ label: 'Other', value: residual, color: NAV_OTHER_COLOR });

    return rows.filter((r) => Math.abs(r.value) > 0.005);
  }, [currentNavCash, currentNavStock, currentNavTotal, navOtherClasses]);

  const chatContext = useMemo(() => {
    // Both currencies go over the wire: a bare market value in the instrument's own
    // currency reads as base-currency money to the model, exactly as it did on screen.
    const topPositions = [...positions]
      .sort((a, b) => Math.abs(b.valueBase ?? b.marketValue) - Math.abs(a.valueBase ?? a.marketValue))
      .slice(0, 25)
      .map((p) => ({
        assetClass: p.assetClass,
        symbol: p.symbol,
        quantity: p.quantity,
        price: p.price,
        currency: p.currency ?? baseCurrency,
        marketValue: p.marketValue,
        marketValueBase: p.valueBase,
        pnlTotal: p.pnlTotal,
        pnlTotalBase: p.pnlBase,
      }));
    const recentTxns = transactions.slice(0, 50).map((t) => ({
      date: t.date,
      type: t.type,
      currency: t.currency,
      amount: t.amount,
      symbol: t.symbol,
      title: t.title,
    }));
    const context = {
      baseCurrency,
      realizedPeriod: series.length ? { from: series[0].date, to: series[series.length - 1].date } : null,
      totalRealizedPnl: totalCalendarPnl,
      navByClass,
      cashBalances,
      positions: topPositions,
      recentTransactions: recentTxns,
      notes: notes.slice(0, 8),
    };
    return JSON.stringify(context, null, 2);
  }, [baseCurrency, cashBalances, navByClass, notes, positions, series, totalCalendarPnl, transactions]);

  const sendChat = useCallback(async () => {
    const input = chatInput.trim();
    if (!input || chatLoading) return;
    const model = chatModel || chatModels[0];
    if (!model) {
      setChatError('No model available. Start Ollama and pull a model first.');
      return;
    }

    const nextMessages = [...chatMessages, { role: 'user' as const, content: input }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);
    setChatError('');

    try {
      const systemPrompt =
        'You are a portfolio assistant. Answer using only the provided statement data. If the answer is not in the data, say you do not know. Be concise.';
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          provider: chatProvider,
          messages: [
            { role: 'system', content: `${systemPrompt}\n\nDATA:\n${chatContext}` },
            ...nextMessages,
          ],
        }),
      });
      if (!res.ok) throw new Error(`Chat failed (${res.status})`);
      const data = await res.json();
      const content = data?.message?.content || data?.content || '';
      setChatMessages((prev) => [...prev, { role: 'assistant', content: content || 'No response.' }]);
    } catch (e: any) {
      setChatError(e?.message || 'Chat failed');
    } finally {
      setChatLoading(false);
    }
  }, [chatContext, chatInput, chatLoading, chatModel, chatModels, chatMessages, chatProvider]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      rawNames,
      isParsing,
      parseError,
      notes,
      rawPreview,
      sourceMode,
      cloudStatus,
      cloudAccounts,
      cloudConnections,
      cloudBusy,
      cloudError,
      cloudProgress,
      cloudSyncedAt,
      setSourceMode,
      checkCloudStatus,
      syncCloud,
      series,
      mode,
      baseCurrency,
      currencyDaily,
      selectedCurrency,
      activeMonth,
      transactions,
      navByClass,
      positions,
      cashBalances,
      txnSearch,
      txnType,
      txnCurrency,
      txnSort,
      selectedTxn,
      chatMessages,
      chatInput,
      chatModels,
      chatModel,
      chatLoading,
      chatError,
      chatProvider,
      chatProviders,
      parseFiles,
      pickFiles,
      clearAll,
      sendChat,
      refreshChatModels: fetchChatModels,
      clearChat: () => setChatMessages([]),
      setSelectedCurrency,
      setActiveMonth,
      setTxnSearch,
      setTxnType,
      setTxnCurrency,
      setTxnSort,
      setSelectedTxn,
      setChatInput,
      setChatModel,
      setChatProvider,
      months,
      activeMonthCells,
      maxAbsPnl,
      monthStats,
      currencies,
      currencyLabel,
      realizedUnit,
      txnCurrenciesAvailable,
      filteredTxns,
      txnSummary,
      totalCalendarPnl,
      portfolioCurve,
      portfolioStats,
      portfolioPeriod,
      portfolioMidDate,
      portfolioAllocation,
      tradeVolume,
      cashComponents,
      cashBreakdown,
      cashVsTrade,
      cashByCurrency,
      currentNavTotal,
      currentNavCash,
      currentNavStock,
      currentUnrealized,
      holdingsAllocation,
      holdingsUnconverted,
      cashAllocationNow,
      navComposition,
      navBreakdown,
      chatContext,
      parseVersion,
    }),
    [
      activeMonth,
      activeMonthCells,
      baseCurrency,
      cashAllocationNow,
      cashBalances,
      cashBreakdown,
      cashByCurrency,
      cashComponents,
      cashVsTrade,
      chatContext,
      chatError,
      chatInput,
      chatLoading,
      chatMessages,
      chatModel,
      chatModels,
      chatProvider,
      chatProviders,
      checkCloudStatus,
      clearAll,
      cloudAccounts,
      cloudBusy,
      cloudConnections,
      cloudError,
      cloudProgress,
      cloudStatus,
      cloudSyncedAt,
      currencies,
      currencyDaily,
      currencyLabel,
      realizedUnit,
      currentNavCash,
      currentNavStock,
      currentNavTotal,
      currentUnrealized,
      filteredTxns,
      holdingsAllocation,
      holdingsUnconverted,
      isParsing,
      maxAbsPnl,
      mode,
      monthStats,
      months,
      navBreakdown,
      navByClass,
      navComposition,
      notes,
      parseError,
      parseFiles,
      parseVersion,
      pickFiles,
      portfolioAllocation,
      portfolioCurve,
      portfolioMidDate,
      portfolioPeriod,
      portfolioStats,
      positions,
      rawNames,
      rawPreview,
      selectedCurrency,
      selectedTxn,
      sendChat,
      fetchChatModels,
      setChatMessages,
      series,
      setActiveMonth,
      setChatInput,
      setChatModel,
      setChatProvider,
      setSelectedCurrency,
      setSelectedTxn,
      setSourceMode,
      sourceMode,
      syncCloud,
      setTxnCurrency,
      setTxnSearch,
      setTxnSort,
      setTxnType,
      totalCalendarPnl,
      tradeVolume,
      transactions,
      txnCurrenciesAvailable,
      txnCurrency,
      txnSearch,
      txnSort,
      txnSummary,
      txnType,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
