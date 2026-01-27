'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import gsap from 'gsap';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DailyPoint = {
  date: string; // YYYY-MM-DD
  pnl: number;
  ret?: number;
  nav?: number;
};

type CurrencyDaily = {
  date: string;
  currency: string;
  pnl: number;
  components: {
    tradesRealized: number;
    tradesFees: number;
    dividends: number;
    interest: number;
    withholdingTax: number;
  };
};

type TxnType = 'TRADE' | 'DIVIDEND' | 'INTEREST' | 'WHT';

type Transaction = {
  id: string;
  date: string;
  type: TxnType;
  currency: string;

  title: string;
  description?: string;
  amount: number;

  symbol?: string;
  side?: 'BUY' | 'SELL';
  quantity?: number;
  tradePrice?: number;
  proceeds?: number;
  realizedPnl?: number;
  fee?: number;

  raw?: Record<string, string>;

  sourceFile?: string;
};

type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
  data?: DailyPoint;
};

type Sizes = { left: number; mid: number; right: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function clamp01(x: number) {
  return clamp(x, 0, 1);
}
function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function toISODate(input: string): string | null {
  const s = (input || '').trim();
  if (!s) return null;

  const mDT = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (mDT) return mDT[1];

  if (/^\d{8}$/.test(s)) {
    const y = s.slice(0, 4),
      m = s.slice(4, 6),
      d = s.slice(6, 8);
    return `${y}-${m}-${d}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m1) {
    const dd = m1[1].padStart(2, '0');
    const mm = m1[2].padStart(2, '0');
    const yy = m1[3];
    return `${yy}-${mm}-${dd}`;
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const dt = new Date(t);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function safeNum(v: any): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const cleaned = s.replace(/[, $]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n: number) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtTxnType(t: TxnType) {
  switch (t) {
    case 'TRADE':
      return 'Trade';
    case 'DIVIDEND':
      return 'Dividend';
    case 'INTEREST':
      return 'Interest';
    case 'WHT':
      return 'Withholding Tax';
    default:
      return t;
  }
}

function typeBadgeVariant(t: TxnType): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (t === 'TRADE') return 'default';
  if (t === 'DIVIDEND') return 'secondary';
  if (t === 'INTEREST') return 'outline';
  return 'destructive';
}

function buildMonthGrid(year: number, monthIndex0: number, dailyMap: Map<string, DailyPoint>): CalendarCell[] {
  const first = new Date(year, monthIndex0, 1);
  const last = new Date(year, monthIndex0 + 1, 0);

  const firstDay = first.getDay();
  const offset = (firstDay + 6) % 7;
  const daysInMonth = last.getDate();

  const cells: CalendarCell[] = [];

  const prevLast = new Date(year, monthIndex0, 0);
  const prevDays = prevLast.getDate();
  for (let i = 0; i < offset; i++) {
    const day = prevDays - offset + 1 + i;
    const dt = new Date(year, monthIndex0 - 1, day);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    cells.push({ date: iso, day, inMonth: false, data: dailyMap.get(iso) });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, monthIndex0, d);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    cells.push({ date: iso, day: d, inMonth: true, data: dailyMap.get(iso) });
  }

  while (cells.length < 42) {
    const nextDay = cells.length - (offset + daysInMonth) + 1;
    const dt = new Date(year, monthIndex0 + 1, nextDay);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    cells.push({ date: iso, day: nextDay, inMonth: false, data: dailyMap.get(iso) });
  }

  return cells;
}

function quantizeIntensity(pnl: number, maxAbs: number) {
  if (maxAbs <= 0) return 0;
  return clamp01(Math.abs(pnl) / maxAbs);
}

function looksLikeIBKRStatement(rows: string[][]): boolean {
  const r0 = rows[0] || [];
  return (r0[0] || '').trim() === 'Statement' && (r0[1] || '').trim() === 'Header';
}

function parseIBKRStatement(rows: string[][]): {
  baseCurrency: string | null;
  currencyDaily: CurrencyDaily[];
  transactions: Transaction[];
  notes: string[];
} {
  const notes: string[] = [];
  let baseCurrency: string | null = null;

  type SectionState = { name: string; header: string[] | null };
  let state: SectionState = { name: '', header: null };

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
  const mkId = (prefix: string, i: number) => `${prefix}-${i}-${Math.random().toString(16).slice(2)}`;
  const normalize = (s: string) => (s || '').trim();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;

    const section = normalize(row[0]);
    const kind = normalize(row[1]);

    if (section === 'Account Information' && kind === 'Data') {
      const fieldName = (row[2] || '').trim();
      const fieldValue = (row[3] || '').trim();
      if (/^Base Currency$/i.test(fieldName)) baseCurrency = fieldValue || null;
    }

    if (kind === 'Header') {
      state = { name: section, header: row.slice(2).map((x) => (x || '').trim()) };
      continue;
    }
    if (kind !== 'Data') continue;

    const header = state.name === section ? state.header : null;
    if (!header) continue;

    const getI = (re: RegExp) => header.findIndex((h) => re.test(h));
    const getByIdx = (idx: number) => (idx >= 0 ? row[2 + idx] || '' : '');

    if (section === 'Trades') {
      const idxCurrency = getI(/^Currency$/i);
      const idxSymbol = getI(/^Symbol$/i);
      const idxDateTime = getI(/^Date\/Time$/i);
      const idxQty = getI(/^Quantity$/i);
      const idxTPrice = getI(/^T\.\s*Price$/i);
      const idxProceeds = getI(/^Proceeds$/i);
      const idxFee = getI(/^Comm\/Fee$/i);
      const idxRealized = getI(/^Realized P\/L$/i);

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

        const title = symbol ? `${symbol} ${side ?? ''}`.trim() : 'Trade';
        const amount = realized + fee;

        txns.push({
          id: mkId('trade', i),
          date: iso,
          type: 'TRADE',
          currency,
          title,
          description: 'Realized P/L + Fees',
          amount,
          symbol: symbol || undefined,
          side,
          quantity: absQty || undefined,
          tradePrice: tPrice || undefined,
          proceeds: proceeds || undefined,
          realizedPnl: realized || undefined,
          fee: fee || undefined,
          raw: Object.fromEntries(header.map((h, j) => [h, row[2 + j] ?? ''])),
        });
      }
      continue;
    }

    if (section === 'Dividends') {
      const idxCurrency = getI(/^Currency$/i);
      const idxDate = getI(/^Date$/i);
      const idxDesc = getI(/^Description$/i);
      const idxAmount = getI(/^Amount$/i);

      const currency = normalize(getByIdx(idxCurrency));
      const iso = toISODate(getByIdx(idxDate));

      if (currency && iso) {
        const amount = safeNum(getByIdx(idxAmount));
        const desc = normalize(getByIdx(idxDesc));

        const d = upsertDaily(iso, currency);
        d.components.dividends += amount;
        d.pnl += amount;

        const symbolGuess = desc.split(' ')[0]?.replace(/[()]/g, '');

        txns.push({
          id: mkId('div', i),
          date: iso,
          type: 'DIVIDEND',
          currency,
          title: symbolGuess ? `Dividend: ${symbolGuess}` : 'Dividend',
          description: desc || undefined,
          amount,
          symbol: symbolGuess || undefined,
          raw: Object.fromEntries(header.map((h, j) => [h, row[2 + j] ?? ''])),
        });
      }
      continue;
    }

    if (section === 'Interest') {
      const idxCurrency = getI(/^Currency$/i);
      const idxDate = getI(/^Date$/i);
      const idxDesc = getI(/^Description$/i);
      const idxAmount = getI(/^Amount$/i);

      const currency = normalize(getByIdx(idxCurrency));
      const iso = toISODate(getByIdx(idxDate));

      if (currency && iso) {
        const amount = safeNum(getByIdx(idxAmount));
        const desc = normalize(getByIdx(idxDesc));

        const d = upsertDaily(iso, currency);
        d.components.interest += amount;
        d.pnl += amount;

        txns.push({
          id: mkId('int', i),
          date: iso,
          type: 'INTEREST',
          currency,
          title: 'Interest',
          description: desc || undefined,
          amount,
          raw: Object.fromEntries(header.map((h, j) => [h, row[2 + j] ?? ''])),
        });
      }
      continue;
    }

    if (section === 'Withholding Tax') {
      const idxCurrency = getI(/^Currency$/i);
      const idxDate = getI(/^Date$/i);
      const idxDesc = getI(/^Description$/i);
      const idxAmount = getI(/^Amount$/i);

      const currency = normalize(getByIdx(idxCurrency));
      const iso = toISODate(getByIdx(idxDate));

      if (currency && iso) {
        const amount = safeNum(getByIdx(idxAmount));
        const desc = normalize(getByIdx(idxDesc));

        const d = upsertDaily(iso, currency);
        d.components.withholdingTax += amount;
        d.pnl += amount;

        txns.push({
          id: mkId('wht', i),
          date: iso,
          type: 'WHT',
          currency,
          title: 'Withholding Tax',
          description: desc || undefined,
          amount,
          raw: Object.fromEntries(header.map((h, j) => [h, row[2 + j] ?? ''])),
        });
      }
      continue;
    }
  }

  const currencyDaily = [...dailyMap.values()].sort((a, b) =>
    a.date === b.date ? a.currency.localeCompare(b.currency) : a.date.localeCompare(b.date)
  );
  txns.sort((a, b) => b.date.localeCompare(a.date));

  if (!baseCurrency) notes.push('Base Currency not found (Account Information → Base Currency).');
  notes.push('Calendar P&L = Trades(Realized+Fees) + Dividends + Interest + Withholding Tax (no unrealized MTM).');
  notes.push(`Transactions: ${txns.length}`);
  notes.push(`CurrencyDaily records: ${currencyDaily.length}`);

  return { baseCurrency, currencyDaily, transactions: txns, notes };
}

function mergeCurrencyDaily(all: CurrencyDaily[]): CurrencyDaily[] {
  const m = new Map<string, CurrencyDaily>(); // key = date|currency

  for (const r of all) {
    const key = `${r.date}|${r.currency}`;
    const existing = m.get(key);

    if (!existing) {
      // deep-ish clone
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

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border p-3 flex flex-col">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mt-1 text-md font-semibold">{value}</div>
    </div>
  );
}

function useColumnResizer(initial: Sizes) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sizes, setSizes] = useState<Sizes>(initial);

  const startDrag = useCallback(
    (which: 'lm' | 'mr') => (e: React.PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;

      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const rect = el.getBoundingClientRect();
      const startX = e.clientX;
      const start = sizes;

      const minLeft = 260;
      const minMid = 520;
      const minRight = 320;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;

        if (which === 'lm') {
          const nextLeft = clamp(start.left + dx, minLeft, rect.width - minMid - minRight);
          const remaining = rect.width - nextLeft;
          const nextMid = clamp(start.mid, minMid, remaining - minRight);
          setSizes({ left: nextLeft, mid: nextMid, right: Math.max(minRight, rect.width - nextLeft - nextMid) });
        } else {
          const nextMid = clamp(start.mid + dx, minMid, rect.width - start.left - minRight);
          setSizes({ left: start.left, mid: nextMid, right: Math.max(minRight, rect.width - start.left - nextMid) });
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [sizes]
  );

  return { containerRef, sizes, startDrag, setSizes };
}

function Splitter({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="relative w-2 cursor-col-resize bg-border/60 hover:bg-border transition"
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-border" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background px-1 py-2 shadow-sm">
        <div className="h-4 w-1 rounded-full bg-muted" />
      </div>
    </div>
  );
}

function InspectorField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium break-words">{value}</div>
    </div>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    m.addEventListener?.('change', onChange);
    return () => m.removeEventListener?.('change', onChange);
  }, [query]);

  return matches;
}

export default function Page() {
  const [rawNames, setRawNames] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string>('');
  const [notes, setNotes] = useState<string[]>([]);
  const [rawPreview, setRawPreview] = useState<any>(null);

  const [series, setSeries] = useState<DailyPoint[]>([]);
  const [mode, setMode] = useState<'IBKR_STATEMENT' | 'UNKNOWN'>('UNKNOWN');

  const [baseCurrency, setBaseCurrency] = useState<string>('HKD');
  const [currencyDaily, setCurrencyDaily] = useState<CurrencyDaily[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');
  const [activeMonth, setActiveMonth] = useState<string>('');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txnSearch, setTxnSearch] = useState('');
  const [txnType, setTxnType] = useState<'ALL' | TxnType>('ALL');
  const [txnCurrency, setTxnCurrency] = useState<'ALL' | string>('ALL');
  const [txnSort, setTxnSort] = useState<'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>('DATE_DESC');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const [activeTab, setActiveTab] = useState<'calendar' | 'transactions' | 'portfolio' | 'raw'>('calendar');

  const dropRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<HTMLDivElement | null>(null);

  const isMobile = useMediaQuery('(max-width: 1024px)'); // tweak breakpoint if you want
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  useEffect(() => {
    if (isMobile && selectedTxn) setMobileInspectorOpen(true);
  }, [isMobile, selectedTxn]);


  const { containerRef: pageColsRef, sizes: pageColSizes, startDrag: startPageDrag } = useColumnResizer({
    left: 340,
    mid: 760,
    right: 420,
  });

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

  const parseFiles = useCallback(
    async (files: File[]) => {
      const list = (files || []).filter(Boolean);
      if (!list.length) return;

      setRawNames(list.map((f) => f.name));
      setIsParsing(true);
      setParseError('');
      setNotes([]);
      setMode('UNKNOWN');
      setSeries([]);
      setCurrencyDaily([]);
      setTransactions([]);
      setRawPreview(null);
      setSelectedTxn(null);

      try {
        const allCurrencyDaily: CurrencyDaily[] = [];
        const allTxns: Transaction[] = [];
        const perFileNotes: { file: string; notes: string[] }[] = [];

        let detectedBaseCurrency: string | null = null;
        const baseCurrencySet = new Set<string>();

        let previewSet = false;

        for (const file of list) {
          const text = await file.text();
          const raw = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true, dynamicTyping: false });

          const rows = (raw.data || []).map((r) => (r || []).map((x) => String(x ?? '')));

          if (!rows.length) {
            perFileNotes.push({ file: file.name, notes: ['CSV has no rows.'] });
            continue;
          }

          if (!looksLikeIBKRStatement(rows)) {
            perFileNotes.push({
              file: file.name,
              notes: ['Not IBKR Activity Statement CSV (Statement/Header/Data). Skipped.'],
            });
            continue;
          }

          const out = parseIBKRStatement(rows);

          if (out.baseCurrency) {
            baseCurrencySet.add(out.baseCurrency);
            if (!detectedBaseCurrency) detectedBaseCurrency = out.baseCurrency;
          }

          allCurrencyDaily.push(...out.currencyDaily);

          // tag each txn with source file for traceability
          allTxns.push(...out.transactions.map((t) => ({ ...t, sourceFile: file.name })));

          perFileNotes.push({ file: file.name, notes: out.notes });

          if (!previewSet) {
            setRawPreview(rows.slice(0, 120));
            previewSet = true;
          }
        }

        if (!allCurrencyDaily.length && !allTxns.length) {
          setParseError('No valid IBKR statement data found in the selected files.');
          setIsParsing(false);
          return;
        }

        setMode('IBKR_STATEMENT');

        // Base currency decision + mismatch note
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

        // sort txns newest first; keep your original behavior
        const mergedTxns = [...allTxns].sort((a, b) => b.date.localeCompare(a.date));
        setTransactions(mergedTxns);

        const base = detectedBaseCurrency || baseCurrency;
        setSelectedCurrency('ALL');
        rebuildSeriesFromCurrencyDaily(mergedDaily, base, 'ALL');

        setNotes(mergeNotes(perFileNotes));

        if (animRef.current) {
          gsap.fromTo(animRef.current, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' });
        }

        setIsParsing(false);
      } catch (e: any) {
        setIsParsing(false);
        setParseError(`Failed to read/parse files: ${e?.message || String(e)}`);
      }
    },
    [baseCurrency, rebuildSeriesFromCurrencyDaily]
  );

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      el.classList.add('ring-2', 'ring-primary');
    };
    const onDragLeave = () => el.classList.remove('ring-2', 'ring-primary');
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      el.classList.remove('ring-2', 'ring-primary');
      const fs = Array.from(e.dataTransfer?.files || []);
      if (fs.length) parseFiles(fs);
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);

    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [parseFiles]);

  const onPickFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.multiple = true; // ✅
    input.onchange = () => {
      const fs = Array.from(input.files || []);
      if (fs.length) parseFiles(fs);
    };
    input.click();
  }, [parseFiles]);

  const onClear = useCallback(() => {
    setRawNames([]);
    setIsParsing(false);
    setParseError('');
    setNotes([]);
    setRawPreview(null);
    setSeries([]);
    setMode('UNKNOWN');
    setCurrencyDaily([]);
    setTransactions([]);
    setActiveMonth('');
    setSelectedCurrency('ALL');

    setTxnSearch('');
    setTxnType('ALL');
    setTxnCurrency('ALL');
    setTxnSort('DATE_DESC');
    setSelectedTxn(null);
    setActiveTab('calendar');
  }, []);

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

  const monthStats = useMemo(() => {
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
    if (mode !== 'IBKR_STATEMENT') return '';
    if (selectedCurrency === 'BASE') return `Base (${baseCurrency})`;
    if (selectedCurrency === 'ALL') return 'ALL (no FX)';
    return selectedCurrency;
  }, [mode, selectedCurrency, baseCurrency]);

  useEffect(() => {
    if (mode !== 'IBKR_STATEMENT') return;
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
      const hay = `${t.title} ${t.description ?? ''} ${t.symbol ?? ''}`.toLowerCase();
      return hay.includes(q);
    });

    list = [...list].sort((a, b) => {
      if (txnSort === 'DATE_DESC') return b.date.localeCompare(a.date);
      if (txnSort === 'DATE_ASC') return a.date.localeCompare(b.date);
      if (txnSort === 'AMOUNT_DESC') return b.amount - a.amount;
      return a.amount - b.amount;
    });

    return list;
  }, [transactions, txnSearch, txnType, txnCurrency, txnSort]);

  const txnSummary = useMemo(() => {
    const total = filteredTxns.reduce((a, t) => a + t.amount, 0);
    const byType = filteredTxns.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + t.amount;
      return acc;
    }, {} as Record<TxnType, number>);

    return { total, byType };
  }, [filteredTxns]);

  useEffect(() => {
    if (!selectedTxn) return;
    const stillExists = filteredTxns.some((t) => t.id === selectedTxn.id);
    if (!stillExists) setSelectedTxn(null);
  }, [filteredTxns, selectedTxn]);

  const totalCalendarPnl = useMemo(() => series.reduce((a, p) => a + p.pnl, 0), [series]);

  const rightPanel = useMemo(() => {
    if (!series.length && !rawNames.length) {
      return (
        <div className="h-full">
          <div className="text-base">Quick Help</div>
          <div className="text-sm text-muted-foreground">Upload IBKR Activity Statement CSV to start.</div>
          <div className="space-y-1 mt-3 text-sm">
            <div>• Drag & drop CSV on the left panel.</div>
            <div>• Calendar is realized/cash only (no unrealized MTM).</div>
            <div>• Use Transactions tab for detailed ledger.</div>
          </div>
        </div>
      );
    }

    if (activeTab === 'transactions') {
      return (
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-base">Transaction Inspector</CardTitle>
            <CardDescription>Click a row to drill down.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedTxn ? (
              <div className="text-sm text-muted-foreground">No transaction selected.</div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={typeBadgeVariant(selectedTxn.type)}>{fmtTxnType(selectedTxn.type)}</Badge>
                  <Badge variant="outline">{selectedTxn.currency}</Badge>
                  <Badge variant="outline">{selectedTxn.date}</Badge>
                  {selectedTxn.symbol && <Badge variant="secondary">{selectedTxn.symbol}</Badge>}
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
                  <InspectorField label="Trade Price" value={selectedTxn.tradePrice !== undefined ? selectedTxn.tradePrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'} />
                  <InspectorField label="Fees" value={selectedTxn.fee !== undefined ? fmtMoney(selectedTxn.fee) : '—'} />
                  <InspectorField label="Realized P/L" value={selectedTxn.realizedPnl !== undefined ? fmtMoney(selectedTxn.realizedPnl) : '—'} />
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
                {rawNames[0]}{rawNames.length > 1 ? ` +${rawNames.length - 1}` : ''}
              </Badge>
            )}
            <Badge>{mode === 'IBKR_STATEMENT' ? 'IBKR Statement Mode' : 'Unknown'}</Badge>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <InspectorField label="Calendar Total P&L" value={fmtMoney(totalCalendarPnl)} />
            <InspectorField label="Transactions" value={transactions.length.toLocaleString()} />
            <InspectorField label="Base Currency" value={baseCurrency} />
            <InspectorField label="Calendar View" value={currencyLabel || '—'} />
            <InspectorField label="Active Month" value={activeMonth || '—'} />
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
  }, [activeTab, baseCurrency, currencyLabel, mode, monthStats, rawNames, selectedTxn, series.length, totalCalendarPnl, transactions.length]);

  return (
    <TooltipProvider>
      {isMobile ? (
        // =========================
        // MOBILE LAYOUT (stacked)
        // =========================
        <div className="p-4 space-y-4">
          {/* Header / actions */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold leading-tight">IBKR Portfolio Management</div>
              <div className="text-xs text-muted-foreground mt-1">Realized/cash calendar + ledger</div>
            </div>
            <Badge variant="outline">v0</Badge>
          </div>

          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={onPickFile}>
              Upload CSV
            </Button>
            <Button size="sm" variant="outline" onClick={onClear} disabled={!series.length && rawNames.length === 0}>
              Clear
            </Button>
          </div>

          <div className="space-y-3">
            {isParsing && (
              <Alert>
                <AlertTitle>Parsing…</AlertTitle>
                <AlertDescription>Reading CSV and building performance + transactions.</AlertDescription>
              </Alert>
            )}

            {parseError && (
              <Alert variant="destructive">
                <AlertTitle>CSV parse failed</AlertTitle>
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {!series.length && !isParsing && (
              <div ref={dropRef}>
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">Drop CSV here</CardTitle>
                    <CardDescription>IBKR Activity Statement (Statement/Header/Data).</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Alert>
                      <AlertTitle>Note</AlertTitle>
                      <AlertDescription>
                        Calendar is realized/cash only (realized P/L + fees + dividends + interest + withholding tax).
                        For total return (unrealized MTM), you need daily NAV/NetLiquidation export.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </div>
            )}

            {(series.length > 0 || rawNames.length > 0) && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  {rawNames.length > 0 && (
                    <Badge variant="secondary">
                      Files: {rawNames.length}
                    </Badge>
                  )}
                  <Badge>{mode === 'IBKR_STATEMENT' ? 'IBKR Statement Mode' : 'Unknown Mode'}</Badge>
                  {mode === 'IBKR_STATEMENT' && <Badge variant="outline">View: {currencyLabel}</Badge>}
                  {series.length > 0 && <Badge variant="outline">Days: {series.length}</Badge>}
                  {transactions.length > 0 && <Badge variant="outline">Txns: {transactions.length}</Badge>}
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatCard title="Calendar Total P&L" value={fmtMoney(totalCalendarPnl)} />
                  <StatCard title="Transactions" value={transactions.length.toLocaleString()} />
                  <StatCard title="Base Currency" value={baseCurrency} />
                </div>

                {mode === 'IBKR_STATEMENT' && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Calendar View</div>
                      <div className="flex gap-2 flex-wrap items-center">
                        <Button size="sm" variant={selectedCurrency === 'ALL' ? 'default' : 'outline'} onClick={() => setSelectedCurrency('ALL')}>
                          ALL
                        </Button>
                        <Button size="sm" variant={selectedCurrency === 'BASE' ? 'default' : 'outline'} onClick={() => setSelectedCurrency('BASE')}>
                          Base ({baseCurrency})
                        </Button>
                        {/* keep currency buttons but trim more aggressively on mobile */}
                        {currencies.slice(0, 4).map((ccy) => (
                          <Button key={ccy} size="sm" variant={selectedCurrency === ccy ? 'default' : 'outline'} onClick={() => setSelectedCurrency(ccy)}>
                            {ccy}
                          </Button>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Tip: use Transactions tab for detailed ledger. Inspector opens when you tap a row.
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Main tab content */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="calendar">Calendar</TabsTrigger>
                  <TabsTrigger value="transactions">Transactions</TabsTrigger>
                  <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* reuse your existing per-tab blocks exactly as-is, just render them here */}
              {activeTab === 'calendar' && (
                <div>
                  <div className="text-base">Calendar</div>
                  <div className="text-sm text-muted-foreground">Hover cells for a quick view.</div>
                  <div className="mt-4 space-y-4">
                    {!activeMonth && (
                      <Alert>
                        <AlertTitle>No month selected</AlertTitle>
                        <AlertDescription>
                          Upload CSV and select a month. If you already have data, pick from the month buttons below.
                        </AlertDescription>
                      </Alert>
                    )}

                    {monthStats && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <StatCard title="Month P&L" value={fmtMoney(monthStats.sumPnl)} />
                          <StatCard title="Win Days" value={`${monthStats.winDays}/${monthStats.days}`} />
                          <StatCard title="Best Day" value={`${monthStats.best.date}  ${fmtMoney(monthStats.best.pnl)}`} />
                          <StatCard title="Worst Day" value={`${monthStats.worst.date}  ${fmtMoney(monthStats.worst.pnl)}`} />
                        </div>
                        <Separator />
                      </>
                    )}

                    <div className="flex gap-2 flex-wrap items-center justify-between">
                      <div className="text-sm text-muted-foreground">Month</div>
                      <div className="flex gap-2 flex-wrap">
                        {months.slice(-18).map((m) => (
                          <Button
                            key={m}
                            size="xs"
                            variant={m === activeMonth ? 'default' : 'outline'}
                            onClick={() => {
                              setActiveMonth(m);
                              gsap.fromTo('.cal-cell', { scale: 0.985, opacity: 0.65 }, { scale: 1, opacity: 1, duration: 0.28, stagger: 0.008, ease: 'power2.out' });
                            }}
                          >
                            {m}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                        <div key={d} className="px-1">
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {activeMonthCells.map((c) => {
                        const pnl = c.data?.pnl ?? 0;
                        const intensity = quantizeIntensity(pnl, maxAbsPnl);
                        const isPos = pnl > 0;

                        const bg = pnl === 0 ? 'bg-muted' : isPos ? 'bg-emerald-500' : 'bg-rose-500';
                        const opacity =
                          pnl === 0
                            ? 'opacity-50'
                            : intensity < 0.2
                              ? 'opacity-30'
                              : intensity < 0.4
                                ? 'opacity-45'
                                : intensity < 0.6
                                  ? 'opacity-60'
                                  : intensity < 0.8
                                    ? 'opacity-75'
                                    : 'opacity-90';
                        const textColor = pnl === 0 ? 'text-muted-foreground' : 'text-white';

                        return (
                          <Tooltip key={c.date}>
                            <TooltipTrigger asChild>
                              <button
                                className={[
                                  'cal-cell rounded-xl h-16 sm:h-20 p-2 text-left transition hover:scale-[1.02] hover:shadow',
                                  c.inMonth ? '' : 'opacity-40',
                                  bg,
                                  opacity,
                                  textColor,
                                ].join(' ')}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium">{c.day}</span>
                                  {c.data ? (
                                    <Badge variant="secondary" className="bg-white/20 text-white border-white/10">
                                      {pnl > 0 ? '+' : ''}
                                      {fmtMoney(pnl)}
                                    </Badge>
                                  ) : (
                                    <span className="text-[11px] opacity-70">—</span>
                                  )}
                                </div>
                                <div className="mt-2 text-[11px] leading-4 opacity-90">{c.data ? 'P&L' : ''}</div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="text-sm font-medium">{c.date}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                P&L ({currencyLabel}):{' '}
                                <span className="font-medium text-foreground">{c.data ? fmtMoney(c.data.pnl) : '—'}</span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'transactions' && (
                <div>
                  <div className="text-lg font-semibold">Transactions</div>
                  <div className="text-sm text-muted-foreground">Filter and click rows. Inspector is on the right panel.</div>
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">Rows: {filteredTxns.length}</Badge>
                      <Badge variant="outline">Total: {fmtMoney(txnSummary.total)}</Badge>
                      {(['TRADE', 'DIVIDEND', 'INTEREST', 'WHT'] as TxnType[]).map((t) => (
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

                    <div className="rounded-xl border overflow-hidden">
                      <div className="p-3 border-b flex items-center justify-between">
                        <div className="text-sm font-medium">Results</div>
                        <Badge variant="outline">{filteredTxns.length}</Badge>
                      </div>

                      <ScrollArea className="h-[360px] sm:h-[520px]">
                        <div className="p-2 space-y-2">
                          {filteredTxns.map((t) => {
                            const isActive = selectedTxn?.id === t.id;
                            const amountCls = t.amount >= 0 ? 'text-emerald-600' : 'text-rose-600';

                            return (
                              <button
                                key={t.id}
                                onClick={() => {
                                  setSelectedTxn(t);
                                  gsap.fromTo('.right-inspector', { y: 8, opacity: 0.65 }, { y: 0, opacity: 1, duration: 0.18, ease: 'power2.out' });
                                }}
                                className={[
                                  'w-full text-left rounded-xl border p-3 transition',
                                  isActive ? 'bg-muted shadow-sm' : 'hover:bg-muted/50',
                                ].join(' ')}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant={typeBadgeVariant(t.type)}>{fmtTxnType(t.type)}</Badge>
                                      <Badge variant="outline">{t.currency}</Badge>
                                      <span className="text-xs text-muted-foreground">{t.date}</span>
                                    </div>

                                    <div className="mt-2 font-medium truncate">{t.title}</div>
                                    {t.description && <div className="mt-1 text-xs text-muted-foreground truncate">{t.description}</div>}

                                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                                      {t.symbol && (
                                        <span>
                                          Symbol: <span className="text-foreground">{t.symbol}</span>
                                        </span>
                                      )}
                                      {t.side && (
                                        <span>
                                          Side: <span className="text-foreground">{t.side}</span>
                                        </span>
                                      )}
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
              )}

              {activeTab === 'portfolio' && (
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Portfolio Management</CardTitle>
                      <CardDescription>Skeleton for next step analytics.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Alert>
                        <AlertTitle>Recommended next</AlertTitle>
                        <AlertDescription>
                          Add “Monthly Summary” (P/L by type + currency), and “Top Symbols by Realized P/L” (from Trades).
                        </AlertDescription>
                      </Alert>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <StatCard title="Total P&L (calendar view)" value={fmtMoney(totalCalendarPnl)} />
                        <StatCard title="Total Transactions" value={transactions.length.toLocaleString()} />
                        <StatCard title="Base Currency" value={baseCurrency} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mobile Inspector (collapsible) */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold">Inspector</div>
                  <div className="text-xs text-muted-foreground">
                    {activeTab === 'transactions' ? 'Shows selected transaction details.' : 'Shows summary context.'}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setMobileInspectorOpen((v) => !v)}>
                  {mobileInspectorOpen ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            {mobileInspectorOpen && <CardContent className="right-inspector">{rightPanel}</CardContent>}
          </Card>
        </div>
      ) : (
        // =========================
        // DESKTOP LAYOUT (your current resizable grid)
        // =========================
        <div className="mx-auto p-4">
          <div
            ref={pageColsRef}
            className="h-[calc(100vh-48px)] rounded-2xl border overflow-hidden bg-background"
            style={{
              display: 'grid',
              gridTemplateColumns: `${pageColSizes.left}px 8px ${pageColSizes.mid}px 8px 1fr`,
            }}
          >
            <div className="h-full flex flex-col min-h-0">
              <div className="p-4 border-b shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold leading-tight">IBKR Portfolio Management</div>
                    <div className="text-xs text-muted-foreground mt-1">Realized/cash calendar + ledger</div>
                  </div>
                  <Badge variant="outline">v0</Badge>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={onPickFile}>
                    Upload CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={onClear} disabled={!series.length && rawNames.length === 0}>
                    Clear
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-4">
                  {isParsing && (
                    <Alert>
                      <AlertTitle>Parsing…</AlertTitle>
                      <AlertDescription>Reading CSV and building performance + transactions.</AlertDescription>
                    </Alert>
                  )}

                  {parseError && (
                    <Alert variant="destructive">
                      <AlertTitle>CSV parse failed</AlertTitle>
                      <AlertDescription>{parseError}</AlertDescription>
                    </Alert>
                  )}

                  {!series.length && !isParsing && (
                    <div ref={dropRef}>
                      <Card className="border-dashed">
                        <CardHeader>
                          <CardTitle className="text-base">Drop CSV here</CardTitle>
                          <CardDescription>IBKR Activity Statement (Statement/Header/Data).</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Alert>
                            <AlertTitle>Note</AlertTitle>
                            <AlertDescription>
                              Calendar is realized/cash only (realized P/L + fees + dividends + interest + withholding tax).
                              For Futu-like total return (unrealized MTM), you need daily NAV/NetLiquidation export.
                            </AlertDescription>
                          </Alert>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {(series.length > 0 || rawNames.length > 0) && (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        {rawNames.length > 0 && (
                          <Badge variant="secondary">
                            Files: {rawNames.length}
                          </Badge>
                        )}
                        <Badge>{mode === 'IBKR_STATEMENT' ? 'IBKR Statement Mode' : 'Unknown Mode'}</Badge>
                        {mode === 'IBKR_STATEMENT' && <Badge variant="outline">View: {currencyLabel}</Badge>}
                        {series.length > 0 && <Badge variant="outline">Days: {series.length}</Badge>}
                        {transactions.length > 0 && <Badge variant="outline">Txns: {transactions.length}</Badge>}
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 gap-3">
                        <StatCard title="Calendar Total P&L" value={fmtMoney(totalCalendarPnl)} />
                        <StatCard title="Transactions" value={transactions.length.toLocaleString()} />
                        <StatCard title="Base Currency" value={baseCurrency} />
                      </div>

                      <Separator />

                      {mode === 'IBKR_STATEMENT' && (
                        <div className="space-y-3">
                          <div className="text-sm">Calendar View Controls</div>
                          <div className="text-sm text-muted-foreground">Controls affect the Calendar tab P&L view.</div>
                          <div className="space-y-3">
                            <div className="flex gap-2 flex-wrap items-center">
                              <Button size="sm" variant={selectedCurrency === 'ALL' ? 'default' : 'outline'} onClick={() => setSelectedCurrency('ALL')}>
                                ALL
                              </Button>
                              {currencies.slice(0, 8).map((ccy) => (
                                <Button key={ccy} size="sm" variant={selectedCurrency === ccy ? 'default' : 'outline'} onClick={() => setSelectedCurrency(ccy)}>
                                  {ccy}
                                </Button>
                              ))}
                              <Button size="sm" variant={selectedCurrency === 'BASE' ? 'default' : 'outline'} onClick={() => setSelectedCurrency('BASE')}>
                                Base ({baseCurrency})
                              </Button>
                            </div>

                            <Separator />

                            <div className="text-xs text-muted-foreground">
                              Tip: switch to <span className="font-medium text-foreground">Transactions</span> tab for detailed ledger.
                            </div>
                          </div>
                        </div>
                      )}

                      {notes.length > 0 && (
                        <div>
                          <div className="text-sm">Parser Notes</div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            {notes.map((n, i) => (
                              <div key={i}>• {n}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>

            <Splitter onPointerDown={startPageDrag('lm')} />

            <div ref={animRef} className="h-full flex flex-col min-h-0">
              <div className="p-4 border-b shrink-0">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList>
                    <TabsTrigger value="calendar">Earnings Calendar</TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                    <TabsTrigger value="raw" hidden>Raw</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-4">
                  {activeTab === 'calendar' && (
                    <div>
                      <div className="text-base">Calendar</div>
                      <div className="text-sm text-muted-foreground">Hover cells for a quick view.</div>
                      <div className="mt-4 space-y-4">
                        {!activeMonth && (
                          <Alert>
                            <AlertTitle>No month selected</AlertTitle>
                            <AlertDescription>
                              Upload CSV and select a month. If you already have data, pick from the month buttons below.
                            </AlertDescription>
                          </Alert>
                        )}

                        {monthStats && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                              <StatCard title="Month P&L" value={fmtMoney(monthStats.sumPnl)} />
                              <StatCard title="Win Days" value={`${monthStats.winDays}/${monthStats.days}`} />
                              <StatCard title="Best Day" value={`${monthStats.best.date}  ${fmtMoney(monthStats.best.pnl)}`} />
                              <StatCard title="Worst Day" value={`${monthStats.worst.date}  ${fmtMoney(monthStats.worst.pnl)}`} />
                            </div>
                            <Separator />
                          </>
                        )}

                        <div className="flex gap-2 flex-wrap items-center justify-between">
                          <div className="text-sm text-muted-foreground">Month</div>
                          <div className="flex gap-2 flex-wrap">
                            {months.slice(-18).map((m) => (
                              <Button
                                key={m}
                                size="xs"
                                variant={m === activeMonth ? 'default' : 'outline'}
                                onClick={() => {
                                  setActiveMonth(m);
                                  gsap.fromTo('.cal-cell', { scale: 0.985, opacity: 0.65 }, { scale: 1, opacity: 1, duration: 0.28, stagger: 0.008, ease: 'power2.out' });
                                }}
                              >
                                {m}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                            <div key={d} className="px-1">
                              {d}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-2">
                          {activeMonthCells.map((c) => {
                            const pnl = c.data?.pnl ?? 0;
                            const intensity = quantizeIntensity(pnl, maxAbsPnl);
                            const isPos = pnl > 0;

                            const bg = pnl === 0 ? 'bg-muted' : isPos ? 'bg-emerald-500' : 'bg-rose-500';
                            const opacity =
                              pnl === 0
                                ? 'opacity-50'
                                : intensity < 0.2
                                  ? 'opacity-30'
                                  : intensity < 0.4
                                    ? 'opacity-45'
                                    : intensity < 0.6
                                      ? 'opacity-60'
                                      : intensity < 0.8
                                        ? 'opacity-75'
                                        : 'opacity-90';
                            const textColor = pnl === 0 ? 'text-muted-foreground' : 'text-white';

                            return (
                              <Tooltip key={c.date}>
                                <TooltipTrigger asChild>
                                  <button
                                    className={[
                                      'cal-cell rounded-xl h-20 p-2 text-left transition hover:scale-[1.02] hover:shadow',
                                      c.inMonth ? '' : 'opacity-40',
                                      bg,
                                      opacity,
                                      textColor,
                                    ].join(' ')}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium">{c.day}</span>
                                      {c.data ? (
                                        <Badge variant="secondary" className="bg-white/20 text-white border-white/10">
                                          {pnl > 0 ? '+' : ''}
                                          {fmtMoney(pnl)}
                                        </Badge>
                                      ) : (
                                        <span className="text-[11px] opacity-70">—</span>
                                      )}
                                    </div>
                                    <div className="mt-2 text-[11px] leading-4 opacity-90">{c.data ? 'P&L' : ''}</div>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="text-sm font-medium">{c.date}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    P&L ({currencyLabel}):{' '}
                                    <span className="font-medium text-foreground">{c.data ? fmtMoney(c.data.pnl) : '—'}</span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'transactions' && (
                    <div>
                      <div className="text-lg font-semibold">Transactions</div>
                      <div className="text-sm text-muted-foreground">Filter and click rows. Inspector is on the right panel.</div>
                      <div className="mt-4 space-y-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">Rows: {filteredTxns.length}</Badge>
                          <Badge variant="outline">Total: {fmtMoney(txnSummary.total)}</Badge>
                          {(['TRADE', 'DIVIDEND', 'INTEREST', 'WHT'] as TxnType[]).map((t) => (
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

                        <div className="rounded-xl border overflow-hidden">
                          <div className="p-3 border-b flex items-center justify-between">
                            <div className="text-sm font-medium">Results</div>
                            <Badge variant="outline">{filteredTxns.length}</Badge>
                          </div>

                          <ScrollArea className="h-[520px]">
                            <div className="p-2 space-y-2">
                              {filteredTxns.map((t) => {
                                const isActive = selectedTxn?.id === t.id;
                                const amountCls = t.amount >= 0 ? 'text-emerald-600' : 'text-rose-600';

                                return (
                                  <button
                                    key={t.id}
                                    onClick={() => {
                                      setSelectedTxn(t);
                                      gsap.fromTo('.right-inspector', { y: 8, opacity: 0.65 }, { y: 0, opacity: 1, duration: 0.18, ease: 'power2.out' });
                                    }}
                                    className={[
                                      'w-full text-left rounded-xl border p-3 transition',
                                      isActive ? 'bg-muted shadow-sm' : 'hover:bg-muted/50',
                                    ].join(' ')}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge variant={typeBadgeVariant(t.type)}>{fmtTxnType(t.type)}</Badge>
                                          <Badge variant="outline">{t.currency}</Badge>
                                          <span className="text-xs text-muted-foreground">{t.date}</span>
                                        </div>

                                        <div className="mt-2 font-medium truncate">{t.title}</div>
                                        {t.description && <div className="mt-1 text-xs text-muted-foreground truncate">{t.description}</div>}

                                        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                                          {t.symbol && (
                                            <span>
                                              Symbol: <span className="text-foreground">{t.symbol}</span>
                                            </span>
                                          )}
                                          {t.side && (
                                            <span>
                                              Side: <span className="text-foreground">{t.side}</span>
                                            </span>
                                          )}
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
                  )}

                  {activeTab === 'portfolio' && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Portfolio Management</CardTitle>
                        <CardDescription>Skeleton for next step analytics.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Alert>
                          <AlertTitle>Recommended next</AlertTitle>
                          <AlertDescription>
                            Add “Monthly Summary” (P/L by type + currency), and “Top Symbols by Realized P/L” (from Trades).
                          </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <StatCard title="Total P&L (calendar view)" value={fmtMoney(totalCalendarPnl)} />
                          <StatCard title="Total Transactions" value={transactions.length.toLocaleString()} />
                          <StatCard title="Base Currency" value={baseCurrency} />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {activeTab === 'raw' && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Raw preview (debug)</CardTitle>
                        <CardDescription>First ~120 parsed CSV rows.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[620px] rounded-xl border p-3">
                          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(rawPreview, null, 2)}</pre>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </div>

            <Splitter onPointerDown={startPageDrag('mr')} />

            <div className="h-full flex flex-col min-h-0">
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 right-inspector">{rightPanel}</div>
              </ScrollArea>
            </div>
          </div>
        </div>
      )
      }
    </TooltipProvider >
  );
}
