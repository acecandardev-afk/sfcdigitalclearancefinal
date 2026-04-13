import { cn } from '@/lib/utils';

export type MyClearanceFilter = 'all' | 'request' | 'pending' | 'approved';

interface MyClearanceFilterTabsProps {
  filter: MyClearanceFilter;
  onFilterChange: (f: MyClearanceFilter) => void;
  stats: { all: number; request: number; pending: number; approved: number };
}

const TABS: { key: MyClearanceFilter; label: string; countKey: keyof MyClearanceFilterTabsProps['stats'] }[] = [
  { key: 'all', label: 'All', countKey: 'all' },
  { key: 'request', label: 'Remaining', countKey: 'request' },
  { key: 'pending', label: 'Pending', countKey: 'pending' },
  { key: 'approved', label: 'Approved', countKey: 'approved' },
];

export function MyClearanceFilterTabs({ filter, onFilterChange, stats }: MyClearanceFilterTabsProps) {
  return (
    <div
      className="flex w-full max-w-full flex-wrap gap-2 lg:w-auto lg:justify-end"
      role="tablist"
      aria-label="Filter clearance steps"
    >
      {TABS.map(({ key, label, countKey }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={filter === key}
          onClick={() => onFilterChange(key)}
          className={cn(
            'rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors',
            filter === key
              ? 'border-[#1a3c5e] bg-[#1a3c5e] text-white shadow-sm dark:border-blue-600 dark:bg-blue-600'
              : 'border-transparent bg-[hsl(42_25%_96%)] text-muted-foreground hover:border-[#1a3c5e]/20 hover:bg-[hsl(42_30%_94%)] dark:bg-muted/50 dark:hover:bg-muted'
          )}
        >
          {label} {stats[countKey]}
        </button>
      ))}
    </div>
  );
}
