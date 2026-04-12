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
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter clearance steps">
      {TABS.map(({ key, label, countKey }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={filter === key}
          onClick={() => onFilterChange(key)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            filter === key
              ? 'bg-[#1a3c5e] text-white dark:bg-blue-600'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          )}
        >
          {label} {stats[countKey]}
        </button>
      ))}
    </div>
  );
}
