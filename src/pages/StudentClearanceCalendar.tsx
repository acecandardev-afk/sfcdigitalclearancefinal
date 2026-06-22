import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isWithinInterval, parseISO, startOfDay, isValid, differenceInCalendarDays } from 'date-fns';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useClearancePeriodSettings } from '@/hooks/useClearancePeriodSettings';
import { useStudentMyClearanceData } from '@/hooks/useStudentMyClearanceData';
import type { UiStepRow } from '@/components/clearance/my-clearance/myClearanceTypes';
import { Loader2, ArrowLeft, CalendarDays, CheckCircle2, Clock, ClipboardList } from 'lucide-react';

function parseActivityDate(row: UiStepRow): Date | null {
  const raw = row.signatureSignedAt || row.signatureCreatedAt;
  if (!raw || typeof raw !== 'string') return null;
  const d = parseISO(raw);
  return isValid(d) ? startOfDay(d) : null;
}

function dayKey(d: Date) {
  return format(startOfDay(d), 'yyyy-MM-dd');
}

export default function StudentClearanceCalendar() {
  const { loading, rows } = useStudentMyClearanceData();
  const { period, loading: periodLoading } = useClearancePeriodSettings();
  const pageLoading = loading || periodLoading;

  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<Date | undefined>(() => startOfDay(new Date()));

  const { activityDayKeys, rowsByDayKey } = useMemo(() => {
    const keys = new Set<string>();
    const map = new Map<string, UiStepRow[]>();
    for (const r of rows) {
      const d = parseActivityDate(r);
      if (!d) continue;
      const k = dayKey(d);
      keys.add(k);
      const list = map.get(k) ?? [];
      list.push(r);
      map.set(k, list);
    }
    return { activityDayKeys: keys, rowsByDayKey: map };
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const approved = rows.filter((r) => r.uiStatus === 'Approved').length;
    const pending = rows.filter((r) => r.uiStatus === 'Pending' || r.uiStatus === 'Request').length;
    const rejected = rows.filter((r) => r.uiStatus === 'Rejected').length;
    return { total, approved, pending, rejected };
  }, [rows]);

  const periodDaysLeft = useMemo(() => {
    if (!period) return null;
    const start = startOfDay(period.start);
    const end = startOfDay(period.end);
    const today = startOfDay(new Date());
    if (today > end) return 0;
    const from = today < start ? start : today;
    return differenceInCalendarDays(end, from) + 1;
  }, [period]);

  const selectedKey = selected ? dayKey(selected) : null;
  const rowsForSelected = selectedKey ? rowsByDayKey.get(selectedKey) ?? [] : [];

  return (
    <DashboardLayout>
      <div className="app-page min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 px-4 py-6 sm:px-6 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="w-full min-w-0 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/clearances" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                My Clearance
              </Link>
            </Button>
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-[#1a3c5e] dark:text-blue-400">Calendar &amp; analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Official clearance window, your office activity dates, and quick progress stats.
            </p>
          </div>

          {pageLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-[#1a3c5e] dark:text-blue-400" />
            </div>
          ) : (
            <>
              {/* Summary analytics */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-gray-200 bg-white/90 shadow-sm dark:border-gray-700 dark:bg-gray-900/90">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Offices
                    </CardDescription>
                    <CardTitle className="text-2xl tabular-nums">{stats.total}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">In your clearance path</CardContent>
                </Card>
                <Card className="border-gray-200 bg-white/90 shadow-sm dark:border-gray-700 dark:bg-gray-900/90">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Approved
                    </CardDescription>
                    <CardTitle className="text-2xl tabular-nums text-emerald-700 dark:text-emerald-400">
                      {stats.approved}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">Steps completed</CardContent>
                </Card>
                <Card className="border-gray-200 bg-white/90 shadow-sm dark:border-gray-700 dark:bg-gray-900/90">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                      In progress / open
                    </CardDescription>
                    <CardTitle className="text-2xl tabular-nums">{stats.pending}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">Pending or not yet requested</CardContent>
                </Card>
                <Card className="border-gray-200 bg-white/90 shadow-sm dark:border-gray-700 dark:bg-gray-900/90">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Clearance window
                    </CardDescription>
                    <CardTitle className="text-lg leading-snug">
                      {period ? (
                        <>
                          {periodDaysLeft !== null && periodDaysLeft > 0 ? (
                            <span className="text-[#1a3c5e] dark:text-blue-400">{periodDaysLeft} days left</span>
                          ) : periodDaysLeft === 0 ? (
                            <span className="text-muted-foreground">Ended</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </>
                      ) : (
                        <span className="text-base font-normal text-muted-foreground">Not configured</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    {period
                      ? `${period.start.toLocaleDateString()} – ${period.end.toLocaleDateString()}`
                      : 'Admin sets this in System Settings'}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <Calendar
                    mode="single"
                    month={month}
                    onMonthChange={setMonth}
                    selected={selected}
                    onSelect={setSelected}
                    modifiers={{
                      clearance_period: (date) =>
                        period
                          ? isWithinInterval(startOfDay(date), {
                              start: startOfDay(period.start),
                              end: startOfDay(period.end),
                            })
                          : false,
                      activity_day: (date) => activityDayKeys.has(dayKey(date)),
                    }}
                    modifiersClassNames={{
                      clearance_period:
                        'bg-emerald-100 text-emerald-900 font-medium dark:bg-emerald-900/40 dark:text-emerald-100',
                      activity_day:
                        'font-semibold text-[#1a3c5e] dark:text-blue-300 relative after:absolute after:bottom-0.5 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-violet-500 after:content-[""]',
                    }}
                    className="mx-auto w-fit rounded-md"
                  />
                  <div className="mt-4 flex flex-wrap justify-center gap-4 border-t border-gray-100 pt-4 text-xs text-muted-foreground dark:border-gray-800">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-6 rounded bg-emerald-100 dark:bg-emerald-900/40" />
                      Clearance period
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="relative inline-flex h-3 w-6 items-end justify-center pb-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                      </span>
                      Office activity (signed / submitted)
                    </span>
                  </div>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    {period ? (
                      <>
                        Green days fall within the configured clearance period (
                        {period.start.toLocaleDateString()} – {period.end.toLocaleDateString()}).
                      </>
                    ) : (
                      <>No official clearance period is configured. Your administrator sets this in System Settings.</>
                    )}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <h2 className="text-sm font-semibold text-foreground">Selected day</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selected ? format(selected, 'EEEE, MMMM d, yyyy') : 'Pick a date on the calendar'}
                    </p>
                    {selected && (
                      <ul className="mt-3 max-h-[220px] space-y-2 overflow-y-auto text-sm">
                        {rowsForSelected.length === 0 ? (
                          <li className="text-muted-foreground">
                            No recorded office activity on this date. Pending steps still appear in{' '}
                            <Link to="/dashboard/clearances" className="font-medium text-[#1a3c5e] underline dark:text-blue-400">
                              My Clearance
                            </Link>
                            .
                          </li>
                        ) : (
                          rowsForSelected.map((r) => (
                            <li
                              key={`${r.id}-${r.signatureId ?? 'x'}`}
                              className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/50"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium text-foreground">{r.office}</span>
                                <Badge
                                  variant="secondary"
                                  className="shrink-0 text-[10px] uppercase"
                                >
                                  {r.uiStatus}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.officer}</p>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <h2 className="text-sm font-semibold text-foreground">Office schedules</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Schedules shown on steps come from My Clearance. Visit each office for current hours.
                    </p>
                    {rows.length > 0 ? (
                      <ul className="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                        {rows.map((r) => (
                          <li
                            key={r.id}
                            className="flex justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-800"
                          >
                            <span className="min-w-0 font-medium text-foreground">{r.office}</span>
                            <span className="shrink-0 text-right text-muted-foreground">{r.schedule}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No clearance steps assigned yet. Open{' '}
                        <Link to="/dashboard/clearances" className="font-medium text-[#1a3c5e] underline dark:text-blue-400">
                          My Clearance
                        </Link>{' '}
                        to start.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
