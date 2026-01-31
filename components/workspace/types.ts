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

export type TxnType = 'TRADE' | 'DIVIDEND' | 'INTEREST' | 'WHT';

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

export type Sizes = { left: number; mid: number; right: number };
export type ActiveTab = 'calendar' | 'transactions' | 'portfolio' | 'chat' | 'raw';
