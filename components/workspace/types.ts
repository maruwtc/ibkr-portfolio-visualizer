export type DailyPoint = {
  date: string; // YYYY-MM-DD
  pnl: number;
  ret?: number;
  nav?: number;
};

export type CurrencyDaily = {
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

export type TxnType = 'TRADE' | 'DIVIDEND' | 'INTEREST' | 'WHT' | 'FEE';

export type Transaction = {
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

  /** Share purchase funded by a dividend (IBKR trade code R / Firstrade reinvestment row). */
  drip?: boolean;

  raw?: Record<string, string>;

  sourceFile?: string;
};

export type Position = {
  assetClass: string;
  symbol: string;
  /** The instrument's own currency, which need not be the statement's base. */
  currency?: string;
  quantity: number;
  price: number;
  /** Market value as the statement reports it — denominated in `currency`. */
  marketValue: number;
  /** `marketValue` converted to the base currency. Absent when no rate was found. */
  valueBase?: number;
  /** Unrealized P/L in `currency`. */
  pnlTotal: number;
  /** `pnlTotal` converted to the base currency. */
  pnlBase?: number;
};

export type CashBalance = {
  currency: string;
  /** The balance in the base currency. */
  valueBase: number;
  /** The balance in its own currency, when the statement reports it. */
  value?: number;
};

export type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
  data?: DailyPoint;
};

export type MonthStats = {
  days: number;
  sumPnl: number;
  winDays: number;
  best: DailyPoint;
  worst: DailyPoint;
};

/** Normalized output of a single statement file, regardless of broker or format. */
export type ParsedStatement = {
  baseCurrency: string | null;
  currencyDaily: CurrencyDaily[];
  transactions: Transaction[];
  navByClass: Record<string, number>;
  positions: Position[];
  cashBalances: CashBalance[];
  statementTimestamp: number | null;
  notes: string[];
};

export type Sizes = { left: number; mid: number; right: number };
export type ActiveTab = 'calendar' | 'transactions' | 'portfolio' | 'chat' | 'raw';

/** Where statement data comes from: parsed on this device, or synced from a broker API. */
export type SourceMode = 'local' | 'cloud';

export type CloudStatus = {
  provider: string;
  available: boolean;
  reason: string | null;
  authenticated: boolean;
  configured: boolean;
  authEnabled: boolean;
  databaseEnabled: boolean;
  maskedClientId: string | null;
  credentialUpdatedAt: string | null;
  user: { name: string | null; email: string | null } | null;
};

/** Marker that this browser has enabled the server's Personal SnapTrade integration. */
export type CloudSession = { mode: 'personal' };

export type CloudAccount = {
  id: string;
  name: string;
  institution: string;
  currency: string | null;
  total: number | null;
};

export type CloudConnection = {
  id: string;
  brokerage: string;
  disabled: boolean;
  updatedAt: string | null;
};
