'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import ThemeToggle from '@/components/theme/ThemeToggle';
import { WorkspaceProvider, useWorkspace } from '@/components/workspace/WorkspaceContext';
import type { ActiveTab } from '@/components/workspace/types';
import { fmtMode, fmtMoney } from '@/components/workspace/utils';

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
    activeMonth,
    monthStats,
    parseVersion,
  } = useWorkspace();

  const dropRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<HTMLDivElement | null>(null);

  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  useEffect(() => {
    if (isMobile && selectedTxn) setMobileInspectorOpen(true);
  }, [isMobile, selectedTxn]);

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
  }, [parseFiles]);

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
          <div className="p-4 pb-24 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-semibold leading-tight">Portfolio Visualizer</div>
                <div className="text-xs text-muted-foreground mt-1">Realized/cash calendar + ledger</div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={pickFiles}>
                  Upload CSV / PDF
                </Button>
                <Button size="sm" variant="outline" onClick={clearAll} disabled={!series.length && rawNames.length === 0}>
                  Clear
                </Button>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                </div>
              </div>
            </div>

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

              {!series.length && !isParsing && (
                <div ref={dropRef}>
                  <Card className="border-dashed">
                    <CardHeader>
                      <CardTitle className="text-base">Drop CSV or PDF here</CardTitle>
                      <CardDescription>IBKR Activity Statement (CSV) or Firstrade statement (PDF).</CardDescription>
                    </CardHeader>
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <StatCard title="Calendar Total P&L" value={fmtMoney(totalCalendarPnl)} />
                    <StatCard title="Transactions" value={transactions.length.toLocaleString()} />
                    <StatCard title="Base Currency" value={baseCurrency} />
                  </div>

                  {mode !== 'UNKNOWN' && viewControls && (
                    <>
                      <Separator />
                      {viewControls}
                    </>
                  )}
                </>
              )}
            </div>

            <Card className="rounded-2xl">
              <CardContent className="space-y-4 pt-6">{children}</CardContent>
            </Card>

            {showSummaryPanel && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-semibold">Inspector</div>
                      <div className="text-xs text-muted-foreground">
                        {activeTab === 'transactions' ? 'Shows selected transaction details.' : 'Shows summary context.'}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setMobileInspectorOpen((v) => !v)}>
                      {mobileInspectorOpen ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </CardHeader>
                {mobileInspectorOpen && <CardContent className="right-inspector">{rightPanel}</CardContent>}
              </Card>
            )}

            <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur h-16 flex items-center justify-center w-full">
              <div className="flex items-center justify-center mx-auto max-w-6xl w-full px-4 py-2 gap-2">
                <NavTabs
                  activeTab={activeTab}
                  labels={{ calendar: 'Calendar', transactions: 'Transactions', portfolio: 'Portfolio', chat: 'Chatbot' }}
                  isMobile
                />
              </div>
            </div>
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
                        labels={{ calendar: 'Calendar', transactions: 'Transactions', portfolio: 'Portfolio', chat: 'Chatbot' }}
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
