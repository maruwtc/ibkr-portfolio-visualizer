# Portfolio Visualizer

A client-side **broker statement analyzer** built with **Next.js + React + Shadcn/UI**, supporting **Interactive Brokers (IBKR) Activity Statement CSVs** and **Firstrade statement PDFs**.

It converts those statements into a **realized P&L calendar**, **transaction ledger**, and **currency-aware performance view** for traders who want **cash-based clarity instead of broker UI noise**.

- Realized only
- No unrealized mark-to-market
- No broker lock-in
- Offline by default; optional broker sync is opt-in

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
- Desktop: fixed side-panel layout (controls / calendar or ledger / inspector)
- Mobile: stacked layout with collapsible inspector and touch-friendly calendar

### Local and Cloud Data Sources
- **Local (default)**: statements are parsed in the browser and nothing leaves the device
- **Cloud (opt-in)**: read-only IBKR sync through SnapTrade, no Trader Workstation or IB Gateway
- The switch is explicit and remembered; local stays the default for anyone who never touches it

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
- Offline-safe in Local mode (no API keys, no backend); cloud sync is opt-in and off by default

### It does NOT do
- Unrealized MTM valuation
- Portfolio NAV tracking
- Live prices
- FX conversion
- Trade execution

If you want true total return, export `NetLiquidation / Daily NAV` from IBKR separately.

---

## Data Sources: Local vs Cloud

Both paths produce the same `ParsedStatement`, so the calendar, ledger and portfolio
views are identical whichever one filled them.

### Local (default)

Upload IBKR CSVs or Firstrade PDFs. Parsing runs in the browser, there is no server
call, and nothing is transmitted. This is the only mode that works on a static
deployment (GitHub Pages), and the only one that needs no configuration.

### Cloud (opt-in, requires a server)

Connects Interactive Brokers through a SnapTrade Personal API key, which is a
read-only brokerage aggregator — **no Trader Workstation, no IB Gateway, no local Java
process**. Brokerage connections are managed in the SnapTrade dashboard; this app never
sees a brokerage credential.

Cloud users sign in with Auth0, then enter their own SnapTrade Personal API credentials
in the Cloud panel. Credentials are scoped to the Auth0 user ID and encrypted with
AES-256-GCM before storage in Postgres; the consumer key is never returned to the
browser.

Set these deployment variables to enable it:

| Variable | Required | Purpose |
| --- | --- | --- |
| `AUTH0_DOMAIN` | yes | Auth0 tenant domain |
| `AUTH0_CLIENT_ID` | yes | Auth0 Regular Web Application client ID |
| `AUTH0_CLIENT_SECRET` | yes | Auth0 application secret |
| `AUTH0_SECRET` | yes | Auth0 cookie secret; generate with `openssl rand -hex 32` |
| `APP_BASE_URL` | yes in production | Public application origin, such as `https://example.com` |
| `DATABASE_URL` | yes | Postgres connection string injected by a Vercel Marketplace storage integration |
| `CREDENTIAL_ENCRYPTION_KEY` | yes | Base64 32-byte key; generate with `openssl rand -base64 32` |
| `SNAPTRADE_BASE_URL` | no | Defaults to `https://api.snaptrade.com/api/v1` |

Create an Auth0 **Regular Web Application**. Configure
`https://YOUR_DOMAIN/auth/callback` as an allowed callback URL and your application
origin as an allowed logout URL. For local development, use
`http://localhost:3000/auth/callback` and `http://localhost:3000`.

On Vercel, install a Postgres provider such as Neon from Marketplace and connect it to
the project so it injects `DATABASE_URL`. The credentials table is created on first use;
the equivalent migration is in `db/migrations/001_snaptrade_credentials.sql`.

Without Auth0 or database configuration, `/api/cloud/status` reports the missing
service and Local mode remains usable. Static exports cannot use Cloud mode because API
routes, authentication, and database access require a server.

The Personal key identifies its SnapTrade owner directly. The app never registers a
subordinate SnapTrade user and never stores or sends a `userId` or `userSecret`.
Brokerage connections remain managed in the SnapTrade dashboard. The application only
syncs data from connections already attached to the saved Personal API key.

**Known limits of the cloud path**

- SnapTrade reports no realized P/L per trade, so trades land in the ledger but are
  excluded from calendar P&L — the same treatment Firstrade PDFs get. Dividends,
  interest, withholding and fees are included.
- No FX rates are supplied. Holdings and cash outside the base currency are shown in
  their own currency and left out of base-currency NAV, with a parser note saying so.
- Activity defaults to the last 730 days.
- Firstrade over the cloud path is **not implemented yet**; use Local mode with a
  statement PDF.

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
- React
- TypeScript
- Shadcn/UI
- Tailwind CSS
- PapaParse (CSV parsing)
- pdf.js / pdfjs-dist (PDF text extraction, in-browser)
- GSAP (light UI animation)

In Local mode there is no backend, database, or network call — everything runs in the
browser. The API routes exist only for the opt-in extras: cloud sync and the local LLM
chat proxy. Neither is reachable on a static export, and both degrade to a clear
"unavailable" message rather than an error.

---

## Project Structure (Simplified)

```
app/
  page.tsx          # Main dashboard
  api/cloud/        # Authenticated SnapTrade configuration and sync
components/
  ui/               # shadcn components
  workspace/
    WorkspaceContext.tsx  # source mode, ingestion, IBKR CSV parser, aggregation
    firstrade.ts          # Firstrade PDF statement parser
    pdf.ts                # in-browser PDF text extraction (pdf.js)
    SourceSwitch.tsx      # Local / Cloud switch
    CloudPanel.tsx        # Auth0 sign-in, credential setup and sync
db/
  migrations/            # Postgres schema for encrypted credentials
lib/
  utils             # helper logic
  auth0.ts          # Auth0 server client
  cloud/            # encrypted per-user credential persistence
  snaptrade/
    client.ts       # signed SnapTrade REST calls (server only)
    map.ts          # SnapTrade payloads -> ParsedStatement
```

All parsing, aggregation, and calculations happen in memory. Cloud responses are
normalized on the server and enter the app through the same ingestion path as a file.

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
