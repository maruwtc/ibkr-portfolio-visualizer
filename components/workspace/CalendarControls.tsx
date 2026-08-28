'use client';

import gsap from 'gsap';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useWorkspace } from './WorkspaceContext';

/** Re-runs the grid's entrance stagger after the visible month changes. */
function animateCells() {
  gsap.fromTo('.cal-cell', { scale: 0.985, opacity: 0.65 }, { scale: 1, opacity: 1, duration: 0.28, stagger: 0.008, ease: 'power2.out' });
}

/** Prev / month / Next. Drives the grid from wherever it is mounted. */
export function MonthNavigator() {
  const { activeMonth, setActiveMonth, months } = useWorkspace();
  const activeIndex = activeMonth ? months.indexOf(activeMonth) : -1;

  const jumpToMonth = (idx: number) => {
    if (idx < 0 || idx >= months.length) return;
    setActiveMonth(months[idx]);
    animateCells();
  };

  const handlePrev = () => {
    if (!months.length) return;
    if (!activeMonth) return jumpToMonth(months.length - 1);
    if (activeIndex > 0) jumpToMonth(activeIndex - 1);
  };

  const handleNext = () => {
    if (!months.length) return;
    if (!activeMonth) return jumpToMonth(months.length - 1);
    if (activeIndex >= 0 && activeIndex < months.length - 1) jumpToMonth(activeIndex + 1);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Month</div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handlePrev} disabled={!months.length || activeIndex <= 0}>
          Prev
        </Button>
        <Select
          value={activeMonth || undefined}
          onValueChange={(v) => {
            setActiveMonth(v);
            animateCells();
          }}
        >
          <SelectTrigger className="min-w-0 flex-1">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {months
              .slice()
              .reverse()
              .map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={handleNext}
          disabled={!months.length || (activeIndex >= 0 && activeIndex >= months.length - 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/** Which currencies the calendar totals. */
export function CurrencyViewControl({ columns = 2 }: { columns?: 2 | 3 }) {
  const { selectedCurrency, setSelectedCurrency, currencies, baseCurrency } = useWorkspace();

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Currency view</div>
      <div className={columns === 3 ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}>
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
  );
}

/** The calendar's full tool set, as the left column presents it. */
export default function CalendarControls() {
  return (
    <div className="space-y-4">
      <MonthNavigator />
      <CurrencyViewControl />
    </div>
  );
}
