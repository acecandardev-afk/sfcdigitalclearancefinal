import { Link } from 'react-router-dom';
import { isWithinInterval } from 'date-fns';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { useClearancePeriodSettings } from '@/hooks/useClearancePeriodSettings';
import { useStudentMyClearanceData } from '@/hooks/useStudentMyClearanceData';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function StudentClearanceCalendar() {
  const { loading, rows } = useStudentMyClearanceData();
  const { period, loading: periodLoading } = useClearancePeriodSettings();
  const pageLoading = loading || periodLoading;

  return (
    <DashboardLayout>
      <div className="app-page min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 px-4 py-6 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/clearances" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                My Clearance
              </Link>
            </Button>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#1a3c5e] dark:text-blue-400">Clearance calendar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Official clearance window (when configured) and your office schedules from My Clearance.
            </p>
          </div>

          {pageLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-[#1a3c5e] dark:text-blue-400" />
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <Calendar
                  mode="single"
                  defaultMonth={period?.start ?? new Date()}
                  selected={new Date()}
                  modifiers={
                    period
                      ? {
                          clearance_period: (date) =>
                            isWithinInterval(date, { start: period.start, end: period.end }),
                        }
                      : undefined
                  }
                  modifiersClassNames={
                    period
                      ? {
                          clearance_period:
                            'bg-emerald-100 text-emerald-900 font-medium dark:bg-emerald-900/40 dark:text-emerald-100',
                        }
                      : undefined
                  }
                  className="mx-auto w-fit rounded-md"
                />
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  {period ? (
                    <>
                      Highlighted days are within the configured clearance period (
                      {period.start.toLocaleDateString()} – {period.end.toLocaleDateString()}).
                    </>
                  ) : (
                    <>No official clearance period is configured. Your administrator sets this in System Settings.</>
                  )}
                </p>
              </div>

              {rows.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <h2 className="text-sm font-semibold text-foreground">Your offices</h2>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {rows.map((r) => (
                      <li
                        key={r.id}
                        className="flex justify-between gap-4 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-800"
                      >
                        <span className="font-medium text-foreground">{r.office}</span>
                        <span className="shrink-0 text-right">{r.schedule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
