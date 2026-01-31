import type { CalendarCell, DailyPoint, TxnType } from './types';

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function clamp01(x: number) {
  return clamp(x, 0, 1);
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function toISODate(input: string): string | null {
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
    return `${m1[3]}-${mm}-${dd}`;
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

export function safeNum(v: any): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const cleaned = s.replace(/[, $]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function fmtMoney(n: number) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatShortDate(iso: string) {
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtTxnType(t: TxnType) {
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

export function typeBadgeVariant(t: TxnType): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (t === 'TRADE') return 'default';
  if (t === 'DIVIDEND') return 'secondary';
  if (t === 'INTEREST') return 'outline';
  return 'destructive';
}

export function buildMonthGrid(year: number, monthIndex0: number, dailyMap: Map<string, DailyPoint>): CalendarCell[] {
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

export function quantizeIntensity(pnl: number, maxAbs: number) {
  if (!maxAbs) return 0;
  return Math.min(1, Math.abs(pnl) / maxAbs);
}
