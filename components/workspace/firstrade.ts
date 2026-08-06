import type { CashBalance, CurrencyDaily, ParsedStatement, Position, Transaction, TxnType } from './types';

/**
 * Parser for Firstrade account statements (PDF).
 *
 * Firstrade statements are laid out for print, not for machines: column positions
 * and section titles drift between statement types. So this parser is line-oriented
 * and tolerant — a row is recognized by its shape (leading trade date + trailing
 * money for activity, symbol + quantity/price/value that multiply out for holdings)
 * rather than by fixed columns. Section headers are only used as a hint.
 *
 * Firstrade statements do not report realized P/L, so trades are surfaced in the
 * ledger but contribute nothing to the calendar; only cash items (dividends,
 * interest, withholding, fees) move daily P&L, which matches the IBKR cash-P&L view.
 */

const CURRENCY = 'USD';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const SYMBOL_STOPWORDS = new Set([
  'A', 'ACCOUNT', 'ADR', 'AMOUNT', 'AND', 'AS', 'AT', 'B', 'BOUGHT', 'BUY', 'C', 'CASH', 'CL',
  'CLASS', 'CO', 'COM', 'COMMISSION', 'CORP', 'CR', 'CUSIP', 'DATE', 'DEBIT', 'DESCRIPTION',
  'DIV', 'DIVIDEND', 'DR', 'ETF', 'EXP', 'FEE', 'FOR', 'FROM', 'FUND', 'GROUP', 'HOLDING',
  'HOLDINGS', 'INC', 'INT', 'INTEREST', 'LLC', 'LP', 'LTD', 'MARKET', 'NEW', 'NRA', 'OF', 'ON',
  'PER', 'PLC', 'PRICE', 'QTY', 'REINVEST', 'REIT', 'SA', 'SETTLE', 'SHARE', 'SHARES', 'SOLD',
  'SYMBOL', 'TAX', 'THE', 'TO', 'TOTAL', 'TRADE', 'TRUST', 'TYPE', 'US', 'USD', 'VALUE',
  'WITHHELD', 'WITHHOLDING',
]);

const US_DATE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;
const US_DATE_FULL = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g;
const RANGE_SEP = /\s*(?:-|–|—|to|through|thru)\s*/i;

export function looksLikeFirstradeStatement(lines: string[]): boolean {
  return lines.some((l) => /firstrade/i.test(l));
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Parses a money/quantity token, handling `$`, thousands separators and `(123.45)` negatives. */
function num(token: string): number | null {
  let s = (token || '').trim().replace(/[$,]/g, '');
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }
  if (s.startsWith('+')) s = s.slice(1);

  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;

  return negative ? -n : n;
}

function isMoneyToken(token: string) {
  return /\d/.test(token) && /^[$(+-]*\d[\d,]*(?:\.\d+)?[)%-]*$/.test(token.trim());
}

type Numeric = { index: number; value: number };

function numericTokens(tokens: string[]): Numeric[] {
  const out: Numeric[] = [];
  tokens.forEach((t, index) => {
    if (!isMoneyToken(t)) return;
    const value = num(t);
    if (value !== null) out.push({ index, value });
  });
  return out;
}

type Period = { start: string | null; end: string | null };

function isoFromParts(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const year = y < 100 ? 2000 + y : y;
  return `${year}-${pad2(m)}-${pad2(d)}`;
}

function parseUsDate(token: string, resolveYear: (m: number, d: number) => number | null): string | null {
  const m = US_DATE.exec((token || '').trim());
  if (!m) return null;

  const month = Number(m[1]);
  const day = Number(m[2]);
  if (m[3]) return isoFromParts(Number(m[3]), month, day);

  const year = resolveYear(month, day);
  if (!year) return null;
  return isoFromParts(year, month, day);
}

function parseLongDate(text: string): string | null {
  const m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(text);
  if (!m) return null;
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (!month) return null;
  return isoFromParts(Number(m[3]), month, Number(m[2]));
}

/** Finds the statement period so undated `MM/DD` rows can be assigned a year. */
function detectPeriod(lines: string[]): Period {
  const head = lines.slice(0, 80);

  for (const line of head) {
    const dates = line.match(US_DATE_FULL);
    if (dates && dates.length >= 2 && RANGE_SEP.test(line.slice(line.indexOf(dates[0]) + dates[0].length))) {
      const start = parseUsDate(dates[0], () => null);
      const end = parseUsDate(dates[1], () => null);
      if (start && end && start <= end) return { start, end };
    }
  }

  for (const line of head) {
    if (!/period|statement|through/i.test(line)) continue;
    const parts = line.split(RANGE_SEP);
    if (parts.length >= 2) {
      const start = parseLongDate(parts[0]);
      const end = parseLongDate(parts[1]) || parseLongDate(`${parts[1]} ${parts[0]}`);
      if (start && end && start <= end) return { start, end };
    }
    const single = /\b([A-Za-z]{3,9})\.?\s+(\d{4})\b/.exec(line);
    if (single && MONTHS[single[1].slice(0, 3).toLowerCase()]) {
      const month = MONTHS[single[1].slice(0, 3).toLowerCase()];
      const year = Number(single[2]);
      const start = isoFromParts(year, month, 1);
      const lastDay = new Date(year, month, 0).getDate();
      const end = isoFromParts(year, month, lastDay);
      if (start && end) return { start, end };
    }
  }

  return { start: null, end: null };
}

/**
 * Picks the year for a bare `MM/DD` row: the candidate year whose resulting date sits
 * closest to the statement period, so a December statement listing `01/02` settlements
 * rolls into the next year instead of the current one.
 */
function makeYearResolver(period: Period) {
  const anchorIso = period.end || period.start;
  const anchor = anchorIso ? Date.parse(`${anchorIso}T00:00:00`) : NaN;
  const fallbackYear = anchorIso ? Number(anchorIso.slice(0, 4)) : new Date().getFullYear();

  return (month: number, day: number): number | null => {
    if (Number.isNaN(anchor)) return fallbackYear;

    let best: { year: number; distance: number } | null = null;
    for (const year of [fallbackYear - 1, fallbackYear, fallbackYear + 1]) {
      const iso = isoFromParts(year, month, day);
      if (!iso) continue;
      const t = Date.parse(`${iso}T00:00:00`);
      if (Number.isNaN(t)) continue;
      const distance = Math.abs(t - anchor);
      if (!best || distance < best.distance) best = { year, distance };
    }
    return best?.year ?? fallbackYear;
  };
}

type ActivityKind = TxnType;

function classify(line: string): ActivityKind | null {
  const s = line.toUpperCase();

  if (/\b(BOUGHT|SOLD|BUY|SELL|PURCHASED?|REDEMPTION|EXERCISE|ASSIGNED?)\b/.test(s)) return 'TRADE';
  if (/\b(TAX\s+WITHHELD|WITHHOLDING|WITHHELD|W\/H\s+TAX)\b/.test(s)) return 'WHT';
  if (/\b(DIVIDEND|DIV|CAPITAL\s+GAIN|DISTRIBUTION)\b/.test(s)) return 'DIVIDEND';
  if (/\bINTEREST\b/.test(s)) return 'INTEREST';
  if (/\b(FEE|FEES|COMMISSION|SERVICE\s+CHARGE|FOREIGN\s+SECURITY\s+CHARGE)\b/.test(s)) return 'FEE';

  return null;
}

function extractSymbol(tokens: string[], stopAt: number): string | undefined {
  for (let i = 0; i < Math.min(tokens.length, stopAt); i++) {
    const raw = tokens[i].replace(/[^A-Za-z.]/g, '');
    if (!raw) continue;
    const candidate = raw.toUpperCase();
    if (!/^[A-Z]{1,5}(?:\.[A-Z]{1,2})?$/.test(candidate)) continue;
    if (SYMBOL_STOPWORDS.has(candidate)) continue;
    return candidate;
  }
  return undefined;
}

type ActivityRow = {
  date: string;
  kind: ActivityKind;
  amount: number;
  symbol?: string;
  description: string;
  side?: 'BUY' | 'SELL';
  quantity?: number;
  price?: number;
  proceeds?: number;
};

/** Recognizes `MM/DD[/YY] [settle date] <description> … <amount>` activity rows. */
function parseActivityLine(line: string, resolveYear: (m: number, d: number) => number | null): ActivityRow | null {
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return null;

  const date = parseUsDate(tokens[0], resolveYear);
  if (!date) return null;

  let rest = tokens.slice(1);
  if (rest.length && US_DATE.test(rest[0])) rest = rest.slice(1); // settlement date column

  const kind = classify(rest.join(' '));
  if (!kind) return null;

  const numerics = numericTokens(rest);
  if (!numerics.length) return null;

  const rawAmount = numerics[numerics.length - 1].value;
  if (!Number.isFinite(rawAmount)) return null;

  const firstNumericIndex = numerics[0].index;
  const description = rest
    .slice(0, firstNumericIndex >= 0 ? firstNumericIndex : rest.length)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const symbol = extractSymbol(rest, firstNumericIndex >= 0 ? firstNumericIndex : rest.length);

  if (kind === 'TRADE') {
    const isSell = /\b(SOLD|SELL|REDEMPTION)\b/i.test(rest.join(' '));
    const side: 'BUY' | 'SELL' = isSell ? 'SELL' : 'BUY';

    let quantity: number | undefined;
    let price: number | undefined;

    const atIndex = rest.findIndex((t) => t === '@');
    if (atIndex >= 0) {
      price = numerics.find((n) => n.index > atIndex)?.value;
      const before = numerics.filter((n) => n.index < atIndex);
      quantity = before.length ? before[before.length - 1].value : undefined;
    } else if (numerics.length >= 3) {
      quantity = numerics[numerics.length - 3].value;
      price = numerics[numerics.length - 2].value;
    }

    if (quantity !== undefined) quantity = Math.abs(quantity);
    const amount = Math.abs(rawAmount) * (side === 'SELL' ? 1 : -1);

    return {
      date,
      kind,
      amount,
      symbol,
      description,
      side,
      quantity,
      price,
      proceeds: amount,
    };
  }

  // Cash items: normalize the sign by kind, since statements mix `-12.34`, `(12.34)` and bare debits.
  const magnitude = Math.abs(rawAmount);
  const amount = kind === 'WHT' || kind === 'FEE' ? -magnitude : magnitude;

  return { date, kind, amount, symbol, description };
}

type HoldingRow = { symbol: string; description: string; quantity: number; price: number; marketValue: number; pnlTotal: number };

/**
 * Recognizes holdings rows by arithmetic rather than by column position: a
 * quantity/price/value triple only counts when quantity × price matches the value.
 */
function parseHoldingLine(line: string): HoldingRow | null {
  // Totals/subtotals rows only — a description like "VANGUARD TOTAL STOCK MKT" is a real holding.
  if (/^\s*(grand\s+)?(sub)?total\b/i.test(line)) return null;

  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return null;
  if (US_DATE.test(tokens[0])) return null;

  const numerics = numericTokens(tokens);
  if (numerics.length < 3) return null;

  for (let i = 0; i + 2 < numerics.length; i++) {
    const quantity = numerics[i].value;
    const price = numerics[i + 1].value;
    const marketValue = numerics[i + 2].value;

    if (quantity <= 0 || price <= 0 || marketValue <= 0) continue;
    const expected = quantity * price;
    if (Math.abs(expected - marketValue) > Math.max(Math.abs(marketValue) * 0.02, 0.05)) continue;

    const symbol = extractSymbol(tokens, numerics[i].index);
    if (!symbol) continue;

    // Optional cost-basis / unrealized columns: accept them only when they reconcile.
    let pnlTotal = 0;
    for (let j = i + 3; j + 1 < numerics.length; j++) {
      const cost = numerics[j].value;
      const gain = numerics[j + 1].value;
      if (Math.abs(marketValue - cost - gain) <= Math.max(Math.abs(marketValue) * 0.02, 0.05)) {
        pnlTotal = gain;
        break;
      }
    }

    const description = tokens
      .slice(0, numerics[i].index)
      .filter((t) => t.toUpperCase() !== symbol)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { symbol, description, quantity, price, marketValue, pnlTotal };
  }

  return null;
}

function firstMoneyOnLine(line: string): number | null {
  const tokens = line.split(/\s+/).filter(Boolean);
  const numerics = numericTokens(tokens).filter((n) => /\.\d{2}$/.test(tokens[n.index].replace(/[$,()]/g, '')));
  return numerics.length ? numerics[0].value : null;
}

const SUMMARY_LABELS: { key: string; re: RegExp }[] = [
  { key: 'total', re: /\b(total\s+(account|portfolio)\s+value|net\s+account\s+value|total\s+value\s+of\s+account|ending\s+(account\s+)?value)\b/i },
  { key: 'cash', re: /\b(total\s+cash|cash\s+(and\s+)?(cash\s+equivalents|money\s+market|balance|credit)|money\s+market\s+funds?)\b/i },
  { key: 'stock', re: /\b((total\s+)?(market\s+value\s+of\s+securities|securities\s+market\s+value|total\s+securities|value\s+of\s+securities)|equit(y|ies)\s+value)\b/i },
];

export function parseFirstradeStatement(lines: string[]): ParsedStatement {
  const notes: string[] = [];
  const period = detectPeriod(lines);
  const resolveYear = makeYearResolver(period);

  const dailyMap = new Map<string, CurrencyDaily>();
  const upsertDaily = (date: string) => {
    const key = `${date}|${CURRENCY}`;
    const existing = dailyMap.get(key);
    if (existing) return existing;
    const fresh: CurrencyDaily = {
      date,
      currency: CURRENCY,
      pnl: 0,
      components: { tradesRealized: 0, tradesFees: 0, dividends: 0, interest: 0, withholdingTax: 0 },
    };
    dailyMap.set(key, fresh);
    return fresh;
  };

  const transactions: Transaction[] = [];
  const positions: Position[] = [];
  const navByClass: Record<string, number> = {};
  const seenRows = new Set<string>();
  const seenPositions = new Set<string>();
  const mkId = (prefix: string, i: number) => `${prefix}-${i}-${Math.random().toString(16).slice(2)}`;

  let activityCount = 0;
  let skippedDatedRows = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    for (const { key, re } of SUMMARY_LABELS) {
      if (navByClass[key] !== undefined || !re.test(line)) continue;
      const value = firstMoneyOnLine(line);
      if (value !== null) navByClass[key] = value;
    }

    const activity = parseActivityLine(line, resolveYear);
    if (activity) {
      const dedupeKey = [activity.date, activity.kind, activity.symbol ?? '', activity.amount, activity.quantity ?? ''].join('|');
      if (seenRows.has(dedupeKey)) continue;
      seenRows.add(dedupeKey);
      activityCount++;

      if (activity.kind !== 'TRADE') {
        const d = upsertDaily(activity.date);
        if (activity.kind === 'DIVIDEND') d.components.dividends += activity.amount;
        if (activity.kind === 'INTEREST') d.components.interest += activity.amount;
        if (activity.kind === 'WHT') d.components.withholdingTax += activity.amount;
        if (activity.kind === 'FEE') d.components.tradesFees += activity.amount;
        d.pnl += activity.amount;
      }

      const title =
        activity.kind === 'TRADE'
          ? `${activity.symbol ?? 'Trade'} ${activity.side ?? ''}`.trim()
          : activity.symbol && activity.kind === 'DIVIDEND'
            ? `${activity.symbol} Dividend`
            : activity.kind === 'INTEREST'
              ? 'Interest'
              : activity.kind === 'WHT'
                ? `${activity.symbol ? `${activity.symbol} ` : ''}Withholding Tax`
                : 'Fee';

      transactions.push({
        id: mkId(activity.kind.toLowerCase(), i),
        date: activity.date,
        type: activity.kind,
        currency: CURRENCY,
        title,
        description: activity.description,
        amount: activity.amount,
        symbol: activity.symbol,
        side: activity.side,
        quantity: activity.quantity,
        tradePrice: activity.price,
        proceeds: activity.kind === 'TRADE' ? activity.proceeds : undefined,
        fee: activity.kind === 'FEE' ? activity.amount : undefined,
        raw: { line },
      });
      continue;
    }

    if (US_DATE.test((line.split(/\s+/)[0] || '')) && /\d\.\d{2}\b/.test(line)) {
      skippedDatedRows++;
      continue;
    }

    const holding = parseHoldingLine(line);
    if (holding && !seenPositions.has(holding.symbol)) {
      seenPositions.add(holding.symbol);
      positions.push({
        assetClass: 'Stocks',
        symbol: holding.symbol,
        quantity: holding.quantity,
        price: holding.price,
        marketValue: holding.marketValue,
        pnlTotal: holding.pnlTotal,
      });
    }
  }

  if (navByClass.stock === undefined && positions.length) {
    navByClass.stock = positions.reduce((acc, p) => acc + p.marketValue, 0);
  }
  if (navByClass.total === undefined && navByClass.cash !== undefined && navByClass.stock !== undefined) {
    navByClass.total = navByClass.cash + navByClass.stock;
  }

  const cashBalances: CashBalance[] =
    navByClass.cash !== undefined && navByClass.cash !== 0 ? [{ currency: CURRENCY, valueBase: navByClass.cash }] : [];

  const statementTimestamp = period.end ? Date.parse(`${period.end}T00:00:00`) : null;

  if (period.start && period.end) notes.push(`Statement period ${period.start} → ${period.end}.`);
  else notes.push('Statement period not found; dates without a year were assigned the nearest plausible year.');

  notes.push(`Parsed ${activityCount} activity rows, ${positions.length} holdings.`);
  notes.push('Firstrade statements do not report realized P/L: trades appear in the ledger but are excluded from calendar P&L (dividends, interest, withholding and fees are included).');
  if (skippedDatedRows) {
    notes.push(`${skippedDatedRows} dated row${skippedDatedRows === 1 ? '' : 's'} (transfers, deposits, other non-P&L entries) skipped.`);
  }

  return {
    baseCurrency: CURRENCY,
    currencyDaily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    transactions,
    navByClass,
    positions,
    cashBalances,
    statementTimestamp: Number.isNaN(statementTimestamp) ? null : statementTimestamp,
    notes,
  };
}
