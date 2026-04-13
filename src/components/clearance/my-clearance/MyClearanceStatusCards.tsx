import { Building2, ClipboardList, Hourglass, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MyClearanceStatusCardsProps {
  operational: { approved: number; total: number; pending: number; remaining: number };
  className?: string;
}

export function MyClearanceStatusCards({ operational, className }: MyClearanceStatusCardsProps) {
  const { approved: a, total: t, pending: p, remaining: r } = operational;

  const cards = [
    {
      label: 'Offices',
      value: t,
      sub: 'total',
      icon: Building2,
      tone: 'from-slate-600 to-slate-800 dark:from-slate-500 dark:to-slate-700',
    },
    {
      label: 'Cleared',
      value: a,
      sub: `of ${operational.total}`,
      icon: CheckCircle2,
      tone: 'from-emerald-500 to-teal-600',
    },
    {
      label: 'In review',
      value: p,
      sub: 'pending',
      icon: Hourglass,
      tone: 'from-amber-500 to-orange-500',
    },
    {
      label: 'To request',
      value: r,
      sub: 'remaining',
      icon: ClipboardList,
      tone: 'from-[#1a3c5e] to-blue-600 dark:from-blue-600 dark:to-indigo-500',
    },
  ];

  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4', className)}>
      {cards.map((c) => (
        <div
          key={c.label}
          className="relative overflow-hidden rounded-sm border border-[#1a3c5e]/12 bg-[hsl(42_38%_99%)] p-3 shadow-sm dark:border-border dark:bg-card/70"
        >
          <div className={cn('absolute -right-2 -top-2 h-16 w-16 rounded-full bg-gradient-to-br opacity-[0.18]', c.tone)} />
          <div className="relative flex items-start justify-between gap-2">
            <div>
              <p className="font-clearance text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {c.label}
              </p>
              <p className="mt-1 font-clearance text-2xl font-semibold tabular-nums text-[#152a45] dark:text-foreground">
                {c.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{c.sub}</p>
            </div>
            <div className={cn('rounded-sm bg-gradient-to-br p-2 text-white shadow-sm', c.tone)}>
              <c.icon className="h-4 w-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
