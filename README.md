# IBKR Portfolio Management Dashboard

A client-side **Interactive Brokers (IBKR) Activity Statement analyzer** built with **Next.js + React + Shadcn/UI**.

This tool converts IBKR CSV statements into a **realized P&L calendar**, **transaction ledger**, and **currency-aware performance view**, designed for traders who want **cash-based clarity instead of broker UI noise**.

> ✅ Realized only  
> ❌ No unrealized mark-to-market  
> ❌ No broker lock-in  
> ✅ Fully offline / browser-only parsing

---

## ✨ Features

### 📅 Earnings Calendar (Realized P&L)
- Daily profit/loss heatmap
- Intensity-based coloring (auto-scaled)
- Monthly statistics:
  - Total P&L
  - Win days
  - Best / worst trading day
- Supports:
  - All currencies combined (no FX)
  - Base currency only
  - Individual currency selection

> Calendar P&L =  
> **Realized trades + fees + dividends + interest + withholding tax**

---

### 📒 Transaction Ledger
- Full normalized transaction table
- Supported transaction types:
  - Trades
  - Dividends
  - Interest
  - Withholding tax
- Powerful filters:
  - Search (symbol / description)
  - Type
  - Currency
  - Sorting (date / amount)
- Transaction inspector:
  - Trade direction
  - Quantity
  - Price
  - Fees
  - Realized P/L
  - Raw IBKR CSV fields (for audit/debug)

---

### 🌍 Multi-Currency Aware
- Automatically detects:
  - Base currency from statement
  - Transaction currencies
- Allows switching calendar view between:
  - `ALL` (no FX conversion)
  - `BASE`
  - Any individual currency
- Prevents false profit caused by FX mixing

---

### 📱 Responsive Layout
- **Desktop**
  - Resizable 3-panel layout
  - Left: controls
  - Middle: calendar / ledger
  - Right: inspector
- **Mobile**
  - Fully stacked layout
  - Collapsible inspector
  - Touch-friendly calendar
  - Optimized transaction browsing

---

### 📂 Multi-File Support
- Upload **multiple IBKR CSV files at once**
- Automatically merges:
  - Daily P&L
  - Transactions
- Detects base currency mismatches
- Adds parser notes per file

---

## 🧠 What This Tool Is (and Isn’t)

### ✅ What it does
- Cash-based performance tracking
- Clean trading journal visualization
- Broker-independent review
- Audit-friendly transaction inspection
- Offline-safe (no API keys, no backend)

### ❌ What it does NOT do
- Unrealized MTM valuation
- Portfolio NAV tracking
- Live prices
- FX conversion
- Trade execution

If you want **true total return**, you must export:
```
NetLiquidation / Daily NAV
```
from IBKR separately.

---

## 📊 Supported IBKR Statement Format

This app expects **IBKR Activity Statement CSV** with:

```
Statement / Header / Data
```

Supported sections:

- Account Information
- Trades
- Dividends
- Interest
- Withholding Tax

Other sections are safely ignored.

---

## 🏗️ Tech Stack

- **Next.js (App Router)**
- **React (client-side only)**
- **TypeScript**
- **Shadcn/UI**
- **Tailwind CSS**
- **PapaParse** (CSV parsing)
- **GSAP** (light UI animation only)

No backend.  
No database.  
No network calls.

Everything runs **locally in the browser**.

---

## 📁 Project Structure (Simplified)

```
app/
 └── page.tsx         # Main dashboard
components/
 └── ui/              # shadcn components
lib/
 └── utils            # helper logic
```

All parsing, aggregation, and calculations are performed in memory.

---

## 🔄 Data Model Overview

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

## ⚠️ Important Notes

- All numbers come **directly from IBKR CSV**
- No rounding beyond display formatting
- No inferred FX
- No guessing of unrealized values

This ensures:
- Audit accuracy
- Statement reconciliation
- No hidden broker logic

---

## 🚀 Recommended Next Enhancements

Planned or easy extensions:

- Monthly summary table
- P&L by symbol
- P&L by strategy
- Equity curve (realized only)
- Import daily NAV for total return
- Export reports (CSV / PDF)
- Tag trades manually

---

## 🔐 Privacy & Security

- No uploads to server
- No analytics
- No cookies
- No API keys
- No storage unless browser chooses to cache

Your brokerage data **never leaves your device**.

---

## 📜 License

MIT License  
Free to modify, fork, and extend.

---

## 🙌 Credits

Built for traders who prefer:

> **Understanding their money  
> instead of trusting a broker dashboard.**
