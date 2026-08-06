import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto p-4">
        <div className="h-[calc(100vh-2rem)] rounded-2xl border overflow-hidden bg-background">
          <div className="p-5 border-b">
            <div className="text-2xl font-semibold">IBKR Portfolio Visualizer</div>
            <div className="text-sm text-muted-foreground mt-1">
              Choose a workspace view to explore your activity statement data.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-5">
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Navigate</div>
              <Link href="/calendar" className="block rounded-2xl border px-4 py-3 hover:bg-muted/40 transition">
                <div className="text-base font-semibold">Calendar</div>
                <div className="text-sm text-muted-foreground">Realized P&L calendar view.</div>
              </Link>
              <Link href="/transactions" className="block rounded-2xl border px-4 py-3 hover:bg-muted/40 transition">
                <div className="text-base font-semibold">Transactions</div>
                <div className="text-sm text-muted-foreground">Ledger and filters.</div>
              </Link>
              <Link href="/portfolio" className="block rounded-2xl border px-4 py-3 hover:bg-muted/40 transition">
                <div className="text-base font-semibold">Portfolio</div>
                <div className="text-sm text-muted-foreground">Current state and performance.</div>
              </Link>
              <Link href="/chat" className="block rounded-2xl border px-4 py-3 hover:bg-muted/40 transition">
                <div className="text-base font-semibold">Chatbot</div>
                <div className="text-sm text-muted-foreground">Ask questions with local LLM.</div>
              </Link>
            </div>

            <div className="rounded-2xl border p-4 space-y-3">
              <div className="text-sm text-muted-foreground">What you can do</div>
              <div className="text-base font-semibold">Upload IBKR & Firstrade Statements</div>
              <div className="text-sm text-muted-foreground">
                Analyze realized P&L, inspect transactions, and view current state snapshots from IBKR Activity Statement CSVs and Firstrade PDF statements.
              </div>
              <div className="text-sm text-muted-foreground">
                Use the Chatbot page to ask questions powered by your local LLM.
              </div>
            </div>

            <div className="rounded-2xl border p-4 space-y-3">
              <div className="text-sm text-muted-foreground">Tips</div>
              <div className="text-sm text-muted-foreground">
                Drag and drop multiple CSV or PDF statements to merge periods. For the most recent portfolio state, upload the latest statement.
              </div>
              <div className="text-sm text-muted-foreground">
                Current state data comes from Net Asset Value, Mark-to-Market Performance Summary, and Forex Balances sections.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
