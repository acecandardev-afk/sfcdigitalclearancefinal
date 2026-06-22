import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { InstitutionalPageBrand } from '@/institutional_clearance/InstitutionalPageBrand';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { parseResponseJson } from '@/lib/parseResponseJson';
import { friendlyApiErrorMessage } from '@/lib/userMessages';

type QueueEntry = {
  clearance: {
    id: string;
    createdAt: string;
  };
};

type QueueResponse = {
  toSign: QueueEntry[];
  waiting: QueueEntry[];
  history: QueueEntry[];
};

export default function InstitutionalSignatoryHome() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueResponse>({ toSign: [], waiting: [], history: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/institutional/signatory/queue', { credentials: 'include' });
        const j = await parseResponseJson(res);
        if (!res.ok) throw new Error(await friendlyApiErrorMessage(res, 'Could not load your signatory queue.'));
        if (!cancelled) {
          setQueue({
            toSign: (j.toSign ?? []) as QueueEntry[],
            waiting: (j.waiting ?? []) as QueueEntry[],
            history: (j.history ?? []) as QueueEntry[],
          });
        }
      } catch {
        if (!cancelled) setQueue({ toSign: [], waiting: [], history: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestStats = useMemo(() => {
    const pendingIds = new Set<string>();
    const signedIds = new Set<string>();
    const allIds = new Set<string>();

    for (const row of queue.toSign) {
      pendingIds.add(row.clearance.id);
      allIds.add(row.clearance.id);
    }
    for (const row of queue.waiting) {
      pendingIds.add(row.clearance.id);
      allIds.add(row.clearance.id);
    }
    for (const row of queue.history) {
      signedIds.add(row.clearance.id);
      allIds.add(row.clearance.id);
    }

    return {
      total: allIds.size,
      signed: signedIds.size,
      pending: pendingIds.size,
    };
  }, [queue]);

  const lineData = useMemo(() => {
    const monthMap = new Map<string, { month: string; total: number; signed: number; pending: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthMap.set(key, {
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        total: 0,
        signed: 0,
        pending: 0,
      });
    }

    const countByMonth = (rows: QueueEntry[], field: 'total' | 'signed' | 'pending') => {
      for (const row of rows) {
        const dt = new Date(row.clearance.createdAt);
        const key = `${dt.getFullYear()}-${dt.getMonth()}`;
        const bucket = monthMap.get(key);
        if (!bucket) continue;
        bucket[field] += 1;
      }
    };

    countByMonth(queue.toSign, 'pending');
    countByMonth(queue.waiting, 'pending');
    countByMonth(queue.history, 'signed');
    countByMonth(queue.toSign, 'total');
    countByMonth(queue.waiting, 'total');
    countByMonth(queue.history, 'total');

    return Array.from(monthMap.values());
  }, [queue]);

  return (
    <DashboardLayout>
      <div className="w-full min-w-0 min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="w-full min-w-0 space-y-8">
          <InstitutionalPageBrand
            title="Institutional — signatory dashboard"
            subtitle="Signatory workspace for reviewing, signing, and tracking institutional clearance rows."
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <CardDescription>Total requests</CardDescription>
                <CardTitle className="text-2xl">{requestStats.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <CardDescription>Signed</CardDescription>
                <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">{requestStats.signed}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <CardDescription>Pending</CardDescription>
                <CardTitle className="text-2xl text-amber-600 dark:text-amber-400">{requestStats.pending}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-lg">Request trend</CardTitle>
              <CardDescription>Total requests, signed, and pending (last 6 months)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="h-[280px] w-full overflow-x-auto">
                  <LineChart width={720} height={260} data={lineData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" name="Total Requests" stroke="#2563eb" strokeWidth={2} />
                    <Line type="monotone" dataKey="signed" name="Signed" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="pending" name="Pending" stroke="#f59e0b" strokeWidth={2} />
                  </LineChart>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/80 bg-gradient-to-br from-sky-500/5 to-transparent">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-[#1e3a5f] dark:text-sky-400" />
                  <CardTitle className="text-lg">Pending signatures</CardTitle>
                </div>
                <CardDescription>Employee exit clearances waiting for your line (not student clearance).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to="/dashboard/institutional/pending">Exit clearance queue</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link to="/dashboard/requests">Student clearance — To sign</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-gradient-to-br from-emerald-500/5 to-transparent">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#1e3a5f] dark:text-sky-400" />
                  <CardTitle className="text-lg">Signed history</CardTitle>
                </div>
                <CardDescription>Rows you already approved, waived, or rejected.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary">
                  <Link to="/dashboard/institutional/signed">Open signed</Link>
                </Button>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

