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
  quantity: number;
  price: number;
  marketValue: number;
  pnlTotal: number;
};

export type CashBalance = {
  currency: string;
  valueBase: number;
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
