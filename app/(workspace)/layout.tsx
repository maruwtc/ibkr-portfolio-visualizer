'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { FileUp, Info, SlidersHorizontal, Upload } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';

import StatCard from '@/components/workspace/StatCard';
import NavTabs from '@/components/workspace/NavTabs';
import useColumnResizer from '@/components/workspace/useColumnResizer';
import Splitter from '@/components/workspace/Splitter';
import RightPanel from '@/components/workspace/RightPanel';
import BottomSheet from '@/components/workspace/BottomSheet';
import TransactionFilters from '@/components/workspace/TransactionFilters';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { WorkspaceProvider, useWorkspace } from '@/components/workspace/WorkspaceContext';
import type { ActiveTab } from '@/components/workspace/types';
import { fmtMode, fmtMoney, fmtTxnType } from '@/components/workspace/utils';

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

function pathToTab(path: string): ActiveTab {
  if (path.startsWith('/transactions')) return 'transactions';
  if (path.startsWith('/portfolio')) return 'portfolio';
  if (path.startsWith('/chat')) return 'chat';
  return 'calendar';
}

function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/calendar';
  const activeTab = pathToTab(pathname);
  const {
    rawNames,
    isParsing,
    parseError,
    notes,
    mode,
    series,
    transactions,
    baseCurrency,
    selectedCurrency,
    currencies,
    currencyLabel,
    totalCalendarPnl,
    portfolioPeriod,
    pickFiles,
    clearAll,
    parseFiles,
    setSelectedCurrency,
    txnType,
    setTxnType,
    txnCurrency,
    setTxnCurrency,
    txnCurrenciesAvailable,
    chatProviders,
    refreshChatModels,
    clearChat,
    chatLoading,
    selectedTxn,
    setSelectedTxn,
    activeMonth,
    monthStats,
    parseVersion,
  } = useWorkspace();

  const dropRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<HTMLDivElement | null>(null);

  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const hasData = series.length > 0 || rawNames.length > 0;

  useEffect(() => {
    if (!parseVersion || !animRef.current) return;
    gsap.fromTo(animRef.current, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' });
  }, [parseVersion]);

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
    // isMobile swaps which element holds dropRef, so the listeners have to re-bind.
  }, [parseFiles, isMobile, hasData]);

  const { containerRef: pageColsRef, sizes: pageColSizes, startDrag: startPageDrag } = useColumnResizer({
    left: 340,
    mid: 760,
    right: 420,
  });

  const showSummaryPanel = activeTab !== 'portfolio' && activeTab !== 'chat';
  const gridTotal = pageColSizes.left + pageColSizes.mid + pageColSizes.right + 16;
  const midFill = `minmax(0, calc(${pageColSizes.mid}px + (100% - ${gridTotal}px)))`;

  const currencyButtons = currencies.slice(0, isMobile ? 4 : 8);
  const txnCurrencyButtons = txnCurrenciesAvailable.slice(0, isMobile ? 4 : 8);

  const rightPanel = (
    <RightPanel
      activeTab={activeTab}
      seriesLength={series.length}
      rawNames={rawNames}
      mode={mode}
      selectedTxn={selectedTxn}
      currencyLabel={currencyLabel}
      totalCalendarPnl={totalCalendarPnl}
      transactionsLength={transactions.length}
      baseCurrency={baseCurrency}
      activeMonth={activeMonth}
      monthStats={monthStats}
    />
  );

  const mobileSubtitle = hasData
    ? [fmtMode(mode).replace(' Mode', ''), transactions.length ? `${transactions.length} txns` : null, baseCurrency]
        .filter(Boolean)
        .join(' · ')
    : 'No statement loaded';

  // Phones surface only the filters that belong to the visible tab, inside a sheet.
  const mobileFilters =
    activeTab === 'transactions' ? (
      <TransactionFilters stacked />
    ) : activeTab === 'calendar' ? (
      <div className="space-y-3">
        <div className="text-sm font-medium">Currency view</div>
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant={selectedCurrency === 'ALL' ? 'default' : 'outline'} onClick={() => setSelectedCurrency('ALL')}>
            ALL
          </Button>
          <Button size="sm" variant={selectedCurrency === 'BASE' ? 'default' : 'outline'} onClick={() => setSelectedCurrency('BASE')}>
            Base · {baseCurrency}
          </Button>
          {currencies.map((ccy) => (
            <Button key={ccy} size="sm" variant={selectedCurrency === ccy ? 'default' : 'outline'} onClick={() => setSelectedCurrency(ccy)}>
              {ccy}
            </Button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">ALL adds currencies together without FX conversion.</div>
      </div>
    ) : null;

  const mobileFilterSummary =
    activeTab === 'transactions'
      ? `${txnType === 'ALL' ? 'All types' : fmtTxnType(txnType)} · ${txnCurrency === 'ALL' ? 'All currencies' : txnCurrency}`
      : currencyLabel;

  const viewControls = (() => {
    if (activeTab === 'calendar') {
      return (
        <div className="space-y-2">
          <div className="text-sm font-medium">Calendar View</div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button size="sm" variant={selectedCurrency === 'ALL' ? 'default' : 'outline'} onClick={() => setSelectedCurrency('ALL')}>
              ALL
            </Button>
            <Button size="sm" variant={selectedCurrency === 'BASE' ? 'default' : 'outline'} onClick={() => setSelectedCurrency('BASE')}>
              Base ({baseCurrency})
            </Button>
            {currencyButtons.map((ccy) => (
              <Button key={ccy} size="sm" variant={selectedCurrency === ccy ? 'default' : 'outline'} onClick={() => setSelectedCurrency(ccy)}>
                {ccy}
              </Button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Tip: use Transactions tab for detailed ledger. Inspector opens when you tap a row.
          </div>
        </div>
      );
    }

    if (activeTab === 'transactions') {
      return (
        <div className="space-y-2">
          <div className="text-sm font-medium">Transactions View</div>
          <div className="flex gap-2 flex-wrap items-center">
            {(['ALL', 'TRADE', 'DIVIDEND', 'INTEREST', 'WHT', 'FEE'] as const).map((t) => (
              <Button key={t} size="sm" variant={txnType === t ? 'default' : 'outline'} onClick={() => setTxnType(t as any)}>
                {t === 'ALL' ? 'All' : t}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button size="sm" variant={txnCurrency === 'ALL' ? 'default' : 'outline'} onClick={() => setTxnCurrency('ALL')}>
              All
            </Button>
            {txnCurrencyButtons.map((ccy) => (
              <Button key={ccy} size="sm" variant={txnCurrency === ccy ? 'default' : 'outline'} onClick={() => setTxnCurrency(ccy)}>
                {ccy}
              </Button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">Tip: use Search + Sort in the Transactions tab.</div>
        </div>
      );
    }

    if (activeTab === 'portfolio') {
      return (
        <div className="space-y-2">
          <div className="text-sm font-medium">Portfolio View</div>
          <div className="text-xs text-muted-foreground">Performance window</div>
          <div className="rounded-md border px-2 py-1 text-xs">{portfolioPeriod}</div>
          <div className="text-xs text-muted-foreground">Base currency: {baseCurrency}</div>
        </div>
      );
    }

    if (activeTab === 'chat') {
      return (
        <div className="space-y-2">
          <div className="text-sm font-medium">Chat View</div>
          <div className="text-xs text-muted-foreground">
            {chatProviders.lmstudio ? 'LM Studio ready' : 'LM Studio not detected'} ·{' '}
            {chatProviders.ollama ? 'Ollama ready' : 'Ollama not detected'}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button size="sm" variant="outline" onClick={refreshChatModels} disabled={chatLoading}>
              Refresh Models
            </Button>
            <Button size="sm" variant="outline" onClick={clearChat} disabled={chatLoading}>
              Clear Chat
            </Button>
          </div>
        </div>
      );
    }

    return null;
  })();

  return (
    <>
      <TooltipProvider>
        {isMobile ? (
          <div className="flex min-h-screen flex-col bg-background">
            <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
              <div className="flex h-14 items-center gap-1 px-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold leading-tight">Portfolio Visualizer</div>
                  <div className="truncate text-[11px] text-muted-foreground">{mobileSubtitle}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={pickFiles} aria-label="Add statement">
                  <Upload className="size-5" />
                </Button>
                <ThemeToggle />
                <Button size="icon" variant="ghost" onClick={() => setDetailsOpen(true)} aria-label="Statement details">
                  <Info className="size-5" />
                </Button>
              </div>

              {hasData && mobileFilters && (
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className="flex w-full items-center gap-2 border-t px-3 py-2 text-left active:bg-muted/50"
                >
                  <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{mobileFilterSummary}</span>
                </button>
              )}
            </header>

            <main className="flex-1 px-3 pb-24 pt-3">
              <div className="space-y-3">
                {isParsing && (
                  <Alert>
                    <AlertTitle>Parsing…</AlertTitle>
                    <AlertDescription>Reading files and building performance + transactions.</AlertDescription>
                  </Alert>
                )}

                {parseError && (
                  <Alert variant="destructive">
                    <AlertTitle>Upload parse failed</AlertTitle>
                    <AlertDescription>{parseError}</AlertDescription>
                  </Alert>
                )}

                {!hasData && !isParsing ? (
                  <div ref={dropRef} className="pt-10">
                    <button
                      type="button"
                      onClick={pickFiles}
                      className="flex w-full flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center active:bg-muted/50"
                    >
                      <FileUp className="size-8 text-muted-foreground" />
                      <span className="mt-4 text-base font-semibold">Add a statement</span>
                      <span className="mt-1 text-sm text-muted-foreground">
                        IBKR Activity Statement (CSV) or Firstrade statement (PDF).
                      </span>
                    </button>
                  </div>
                ) : (
                  <>
                    {hasData && (
                      <div className="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 [&::-webkit-scrollbar]:hidden [&>*]:min-w-[45%] [&>*]:shrink-0 [&>*]:snap-start">
                        <StatCard title="Calendar P&L" value={fmtMoney(totalCalendarPnl)} />
                        <StatCard title="Transactions" value={transactions.length.toLocaleString()} />
                        <StatCard title="Base Currency" value={baseCurrency} />
                      </div>
                    )}

                    <div className="min-h-[55vh]">{children}</div>
                  </>
                )}
              </div>
            </main>

            <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
              <div className="px-2 py-1">
                <NavTabs
                  activeTab={activeTab}
                  labels={{ portfolio: 'Portfolio', transactions: 'Transactions', calendar: 'Calendar', chat: 'Chatbot' }}
                  isMobile
                />
              </div>
            </nav>

            <BottomSheet
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              title="Filters"
              description={activeTab === 'transactions' ? 'Narrow down the ledger.' : 'Choose which currencies the calendar totals.'}
            >
              <div className="pb-2">{mobileFilters}</div>
            </BottomSheet>

            <BottomSheet
              open={detailsOpen}
              onClose={() => setDetailsOpen(false)}
              title="Statement"
              description={hasData ? fmtMode(mode) : 'Nothing loaded yet.'}
            >
              <div className="space-y-4 pb-2">
                {hasData && (
                  <div className="flex flex-wrap gap-2">
                    {mode !== 'UNKNOWN' && <Badge variant="outline">View: {currencyLabel}</Badge>}
                    {series.length > 0 && <Badge variant="outline">Days: {series.length}</Badge>}
                    {transactions.length > 0 && <Badge variant="outline">Txns: {transactions.length}</Badge>}
                  </div>
                )}

                {rawNames.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Files</div>
                    {rawNames.map((n) => (
                      <div key={n} className="truncate text-xs text-muted-foreground">
                        {n}
                      </div>
                    ))}
                  </div>
                )}

                {notes.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Parser notes</div>
                    {notes.map((n, i) => (
                      <div key={i} className="text-xs text-muted-foreground">
                        • {n}
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsOpen(false);
                      pickFiles();
                    }}
                  >
                    Add statement
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsOpen(false);
                      clearAll();
                    }}
                    disabled={!hasData}
                  >
                    Clear data
                  </Button>
                </div>
              </div>
            </BottomSheet>

            <BottomSheet
              open={activeTab === 'transactions' && !!selectedTxn}
              onClose={() => setSelectedTxn(null)}
              title="Transaction"
              description={selectedTxn?.title}
            >
              <div className="right-inspector pb-2">{rightPanel}</div>
            </BottomSheet>
          </div>
        ) : (
          <div ref={pageColsRef} className="p-4">
            <div className="h-[calc(100vh-2rem)] rounded-2xl border overflow-hidden bg-background">
              <div
                className="h-full w-full grid"
                style={{
                  gridTemplateColumns: showSummaryPanel
                    ? `${pageColSizes.left}px 8px ${midFill} 8px ${pageColSizes.right}px`
                    : `${pageColSizes.left}px 8px minmax(0, 1fr)`,
                }}
              >
                <div className="h-full flex flex-col min-h-0">
                  <div className="px-3 pt-4 pb-3">
                    <div className="flex items-center justify-between mb-4 gap-2">
                      <NavTabs
                        activeTab={activeTab}
                        labels={{ portfolio: 'Portfolio', transactions: 'Transactions', calendar: 'Calendar', chat: 'Chatbot' }}
                      />
                      <ThemeToggle />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-semibold">Portfolio Visualizer</div>
                        <div className="text-sm text-muted-foreground">Realized/cash calendar + ledger</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v0</Badge>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={pickFiles}>
                        Upload CSV / PDF
                      </Button>
                      <Button size="sm" variant="outline" onClick={clearAll} disabled={!series.length && rawNames.length === 0}>
                        Clear
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-4 space-y-4 min-h-full flex flex-col">
                      {isParsing && (
                        <Alert>
                          <AlertTitle>Parsing…</AlertTitle>
                          <AlertDescription>Reading files and building performance + transactions.</AlertDescription>
                        </Alert>
                      )}

                      {parseError && (
                        <Alert variant="destructive">
                          <AlertTitle>Upload parse failed</AlertTitle>
                          <AlertDescription>{parseError}</AlertDescription>
                        </Alert>
                      )}

                      {!series.length && !isParsing && (
                        <div ref={dropRef}>
                          <Card className="border-dashed" onClick={pickFiles} style={{ cursor: 'pointer' }}>
                            <CardHeader>
                              <CardTitle className="text-base">Click to Upload / Drop CSV or PDF here</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <Alert>
                                <AlertDescription>IBKR Activity Statement (CSV) or Firstrade statement (PDF).</AlertDescription>
                              </Alert>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {(series.length > 0 || rawNames.length > 0) && (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            {rawNames.length > 0 && <Badge variant="secondary">Files: {rawNames.length}</Badge>}
                            <Badge>{fmtMode(mode)}</Badge>
                            {mode !== 'UNKNOWN' && <Badge variant="outline">View: {currencyLabel}</Badge>}
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

                          {mode !== 'UNKNOWN' && viewControls && (
                            <div className="space-y-3">
                              <div className="text-sm">View Controls</div>
                              <div className="text-sm text-muted-foreground">Controls change based on the active tab.</div>
                              <Separator />
                              {viewControls}
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
                  {activeTab === 'transactions' ? (
                    <div className="flex-1 min-h-0">
                      <div className="p-4 space-y-4 h-full flex flex-col">{children}</div>
                    </div>
                  ) : (
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="p-4 space-y-4">{children}</div>
                    </ScrollArea>
                  )}
                </div>

                {showSummaryPanel && (
                  <>
                    <Splitter onPointerDown={startPageDrag('mr')} />
                    <div className="h-full flex flex-col min-h-0">
                      <ScrollArea className="flex-1 min-h-0">
                        <div className="p-4 right-inspector">{rightPanel}</div>
                      </ScrollArea>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </TooltipProvider>
    </>
  );
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceProvider>
  );
}
