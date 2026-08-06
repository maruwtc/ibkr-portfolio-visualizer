# Portfolio Visualizer

A client-side **broker statement analyzer** built with **Next.js + React + Shadcn/UI**, supporting **Interactive Brokers (IBKR) Activity Statement CSVs** and **Firstrade statement PDFs**.

It converts those statements into a **realized P&L calendar**, **transaction ledger**, and **currency-aware performance view** for traders who want **cash-based clarity instead of broker UI noise**.

- Realized only
- No unrealized mark-to-market
- No broker lock-in
- Fully offline / browser-only parsing

---

## Features

### Earnings Calendar (Realized P&L)
- Daily profit/loss heatmap
- Auto-scaled intensity coloring
- Monthly stats: total P&L, win days, best/worst day
- Views: all currencies combined (no FX), base currency only, or a single currency

Calendar P&L = **Realized trades + fees + dividends + interest + withholding tax**

### Transaction Ledger
- Normalized transaction table
- Types: trades, dividends, interest, withholding tax, fees
- Filters: search (symbol/description), type, currency, sorting (date/amount)
- Inspector: trade direction, quantity, price, fees, realized P/L, raw statement fields

### Multi-Currency Aware
- Detects base currency and transaction currencies from statements
- Calendar view supports ALL (no FX), BASE, or a specific currency
- Avoids false profit from FX mixing

### Responsive Layout
- Desktop: resizable 3-panel layout (controls / calendar or ledger / inspector)
- Mobile: stacked layout with collapsible inspector and touch-friendly calendar

### Multi-File Support
- Upload multiple IBKR CSV and Firstrade PDF files at once (drag & drop or file picker)
- Merges daily P&L and transactions
- Detects base currency mismatches
- Adds parser notes per file

---

## What This Tool Is (and Isn’t)

### It does
- Cash-based performance tracking
- Clean trading journal visualization
- Broker-independent review
- Audit-friendly transaction inspection
- Offline-safe (no API keys, no backend)

### It does NOT do
- Unrealized MTM valuation
- Portfolio NAV tracking
- Live prices
- FX conversion
- Trade execution

If you want true total return, export `NetLiquidation / Daily NAV` from IBKR separately.

---

## Supported Statement Formats

### IBKR Activity Statement (CSV)

Expected CSV sections:

```
Statement / Header / Data
```

Supported sections:
- Account Information
- Trades
- Dividends
- Interest
- Withholding Tax

Other sections are ignored safely.

### Firstrade Statement (PDF)

Text is extracted in the browser with pdf.js and parsed line by line, so the parser
tolerates the layout drift between Firstrade statement types:

- Account summary: total account value, cash, market value of securities
- Holdings: accepted only when quantity x price reconciles with market value
- Activity: trades, dividends, interest, withholding tax, fees

Firstrade statements do not report realized P/L, so trades appear in the ledger but
are excluded from calendar P&L; dividends, interest, withholding and fees are included.
Scanned (image-only) PDFs have no text layer and are skipped with a parser note.

---

## Tech Stack

- Next.js (App Router)
- React (client-side only)
- TypeScript
- Shadcn/UI
- Tailwind CSS
- PapaParse (CSV parsing)
- pdf.js / pdfjs-dist (PDF text extraction, in-browser)
- GSAP (light UI animation)

No backend, database, or network calls. Everything runs locally in the browser.

---

## Project Structure (Simplified)

```
app/
  page.tsx          # Main dashboard
components/
  ui/               # shadcn components
  workspace/
    WorkspaceContext.tsx  # upload dispatch, IBKR CSV parser, aggregation
    firstrade.ts          # Firstrade PDF statement parser
    pdf.ts                # in-browser PDF text extraction (pdf.js)
lib/
  utils             # helper logic
```

All parsing, aggregation, and calculations happen in memory.

---

## Data Model Overview

### Daily P&L
```ts
DailyPoint {
  date: string
  pnl: number
}
```

### Currency Breakdown
```ts
CurrencyDaily {
  date: string
  currency: string
  pnl: number
  components: {
    tradesRealized
    tradesFees
    dividends
    interest
    withholdingTax
  }
}
```

### Transaction Ledger
```ts
Transaction {
  date
  type
  currency
  amount
  symbol?
  quantity?
  fee?
  realizedPnl?
  raw?
}
```

---

## Important Notes

- All numbers come directly from the uploaded statement
- No rounding beyond display formatting
- No inferred FX
- No guessing of unrealized values

This ensures audit accuracy and statement reconciliation without hidden broker logic.

---

## Recommended Next Enhancements

- Monthly summary table
- P&L by symbol
- P&L by strategy
- Equity curve (realized only)
- Import daily NAV for total return
- Export reports (CSV / PDF)
- Manual trade tags

---

## Privacy & Security

- No uploads to server
- No analytics
- No cookies
- No API keys
- No storage unless the browser caches assets

Your brokerage data never leaves your device.

---

## License

MIT License — free to modify, fork, and extend.

---

## Credits

Built for traders who prefer understanding their money instead of trusting a broker dashboard.
