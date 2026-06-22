import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfDay, isWithinInterval } from 'date-fns';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { InstitutionalPageBrand } from '@/institutional_clearance/InstitutionalPageBrand';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { parseResponseJson } from '@/lib/parseResponseJson';

type Row = {
  id: string;
  fullName: string;
  department: string;
  status: string;
  createdAt: string;
};

function keyOf(date: Date) {
  return format(startOfDay(date), 'yyyy-MM-dd');
}

export default function InstitutionalCalendarPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date | undefined>(startOfDay(new Date()));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/institutional/clearances', { credentials: 'include' });
        const j = await parseResponseJson(res);
        if (!res.ok) throw new Error('Failed to load');
        if (!cancelled) setRows((j.clearances ?? []) as Row[]);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const signed = rows.filter((r) => r.status === 'completed').length;
    const pending = rows.filter((r) => r.status === 'pending' || r.status === 'in_progress').length;
    return { total, signed, pending };
  }, [rows]);

  const dayMap = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const d = new Date(r.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const k = keyOf(d);
      const curr = map.get(k) ?? [];
      curr.push(r);
      map.set(k, curr);
    }
    return map;
  }, [rows]);

  const period = useMemo(() => {
    if (rows.length === 0) return null;
    const dates = rows
      .map((r) => new Date(r.createdAt))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) return null;
    return { start: startOfDay(dates[0]), end: startOfDay(dates[dates.length - 1]) };
  }, [rows]);

  const selectedRows = selected ? dayMap.get(keyOf(selected)) ?? [] : [];

  return (
    <DashboardLayout>
      <div className="app-page min-h-screen w-full space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard/institutional/clearances" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            My Clearance
          </Link>
        </Button>

        <InstitutionalPageBrand
          title="Calendar & Analytics"
          subtitle="Track employee request activity dates and progress analytics."
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" />Total requests</CardDescription><CardTitle>{stats.total}</CardTitle></CardHeader></Card>
              <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Signed</CardDescription><CardTitle className="text-emerald-700">{stats.signed}</CardTitle></CardHeader></Card>
              <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-amber-600" />Pending</CardDescription><CardTitle>{stats.pending}</CardTitle></CardHeader></Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card>
                <CardContent className="p-4">
                  <Calendar
                    mode="single"
                    month={month}
                    onMonthChange={setMonth}
                    selected={selected}
                    onSelect={setSelected}
                    modifiers={{
                      active_day: (date) => dayMap.has(keyOf(date)),
                      range_day: (date) =>
                        period ? isWithinInterval(startOfDay(date), { start: period.start, end: period.end }) : false,
                    }}
                    modifiersClassNames={{
                      active_day:
                        'font-semibold text-primary relative after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-[""]',
                      range_day: 'bg-primary/10',
                    }}
                    className="mx-auto w-fit"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4" />Selected day</CardTitle>
                  <CardDescription>{selected ? format(selected, 'MMMM d, yyyy') : 'Pick a date'}</CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No employee requests recorded on this day.</p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedRows.map((r) => (
                        <li key={r.id} className="rounded-lg border p-2">
                          <p className="font-medium">{r.fullName}</p>
                          <p className="text-xs text-muted-foreground">{r.department}</p>
                          <Badge variant="secondary" className="mt-1 capitalize">{r.status.replace(/_/g, ' ')}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

