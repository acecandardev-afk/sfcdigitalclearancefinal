import { useEffect, useMemo, useState } from 'react';
import { parseResponseJson } from '@/lib/parseResponseJson';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Loader2, Shield } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { InstitutionalPageBrand } from '@/institutional_clearance/InstitutionalPageBrand';
import InstitutionalClearanceInsights from '@/institutional_clearance/InstitutionalClearanceInsights';
import { canCreateOwnInstitutionalClearanceRequest, isInstitutionalElevatedAdmin } from '@/lib/permissionsMatrix';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CartesianGrid, Legend, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type CountState = { total: number; loading: boolean };
type ClearanceRow = {
  id: string;
  fullName: string;
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'rejected';
  createdAt: string;
};

export default function InstitutionalHome() {
  const navigate = useNavigate();
  const { isSuperAdmin, isEmployee, roles, isSignatory, isHrAdmin } = useUserRole();
  const canStartOwnRequest = canCreateOwnInstitutionalClearanceRequest(roles);
  const [c, setC] = useState<CountState>({ total: 0, loading: true });
  const [rows, setRows] = useState<ClearanceRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/institutional/clearances', { credentials: 'include' });
        const j = await parseResponseJson(res);
        if (!res.ok) throw new Error();
        if (!cancelled) {
          const clearances = (j.clearances ?? []) as ClearanceRow[];
          setRows(clearances);
          setC({ total: clearances.length, loading: false });
        }
      } catch {
        if (!cancelled) setC({ total: 0, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const trendData = useMemo(() => {
    const buckets = new Map<string, { month: string; submitted: number; signed: number; pending: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(`${d.getFullYear()}-${d.getMonth()}`, {
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        submitted: 0,
        signed: 0,
        pending: 0,
      });
    }
    for (const r of rows) {
      const dt = new Date(r.createdAt);
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      const b = buckets.get(key);
      if (!b) continue;
      if (r.status !== 'draft') b.submitted += 1;
      if (r.status === 'completed') b.signed += 1;
      if (r.status === 'pending' || r.status === 'in_progress') b.pending += 1;
    }
    return Array.from(buckets.values());
  }, [rows]);

  const overview = useMemo(() => {
    const submitted = rows.filter((r) => r.status !== 'draft').length;
    const pending = rows.filter((r) => r.status === 'pending' || r.status === 'in_progress').length;
    const signed = rows.filter((r) => r.status === 'completed').length;
    return { submitted, pending, signed };
  }, [rows]);

  const recentRows = useMemo(
    () => [...rows].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5),
    [rows]
  );

  const progressTotal = overview.signed + overview.pending;
  const progressPct = progressTotal > 0 ? Math.round((overview.signed / progressTotal) * 100) : 0;
  const progressChartData = [
    { name: 'Signed', value: overview.signed, fill: '#10b981' },
    { name: 'Pending', value: overview.pending, fill: '#f59e0b' },
  ].filter((d) => d.value > 0);

  return (
    <DashboardLayout>
      <div className="app-page min-h-screen w-full min-w-0 bg-gradient-to-br from-slate-50/80 via-blue-50/20 to-transparent px-4 py-6 dark:from-gray-950/50 dark:via-gray-900/30 sm:px-6 lg:px-8">
        <div className="w-full min-w-0 space-y-8">
          <InstitutionalPageBrand
            title="Employee overview"
            subtitle={
              canStartOwnRequest
                ? 'Use My Clearance to submit and track your institutional requests.'
                : 'Review institutional exit clearances and manage signatories from Admin overview or the full list.'
            }
          />
          <div className="mb-6 flex justify-end -mt-4 sm:-mt-2">
            <Button
              onClick={() => navigate('/dashboard/institutional/clearances')}
              className="shrink-0 shadow-sm bg-[#1a3c5e] hover:bg-[#15304d] dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {isSuperAdmin() || !canStartOwnRequest ? 'All clearances' : 'My Clearance'}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <CardDescription>Submitted</CardDescription>
                <CardTitle className="text-2xl">{overview.submitted}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <CardDescription>Pending</CardDescription>
                <CardTitle className="text-2xl text-amber-600 dark:text-amber-400">{overview.pending}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <CardDescription>Signed</CardDescription>
                <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">{overview.signed}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {!c.loading && <InstitutionalClearanceInsights clearances={rows} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/80 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="text-lg">
                  {isSuperAdmin() ? 'All records' : 'My records'}
                </CardTitle>
                <CardDescription>
                  {isSuperAdmin()
                    ? 'Every institutional clearance in the system (employee view).'
                    : 'Clearance forms you have started or submitted.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {c.loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-3xl font-semibold tabular-nums">{c.total}</p>
                )}
                <Button asChild className="mt-4" variant="secondary">
                  <Link to="/dashboard/institutional/clearances">
                    {canStartOwnRequest ? 'Open My Clearance' : 'Open all clearances'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
            {canStartOwnRequest && (
            <Card className="border-border/80 bg-gradient-to-br from-sky-500/5 to-transparent">
              <CardHeader>
                <CardTitle className="text-lg">New request</CardTitle>
                <CardDescription>Start a new institutional clearance request.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link to="/dashboard/institutional/clearances/new">Create new</Link>
                </Button>
              </CardContent>
            </Card>
            )}
            {isSignatory() && isInstitutionalElevatedAdmin(roles) && (
              <Card className="border-border/80 bg-gradient-to-br from-amber-500/5 to-transparent">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-[#1e3a5f] dark:text-sky-400" />
                    <CardTitle className="text-lg">Signing duties (institutional)</CardTitle>
                  </div>
                  <CardDescription>
                    When you also hold a signatory assignment, open the queue from here (separate from admin
                    overview).
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link to="/dashboard/institutional/pending">Exit clearance — pending</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/dashboard/institutional/signed">Exit clearance — history</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/dashboard/requests">Student clearance — To sign</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
            {(isSuperAdmin() || isHrAdmin()) && (
              <Card className="border-border/80 bg-gradient-to-br from-emerald-500/5 to-transparent">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-[#1e3a5f] dark:text-sky-400" />
                    <CardTitle className="text-lg">Request status</CardTitle>
                  </div>
                  <CardDescription>Track pending, signed, and rejected rows on your requests.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link to="/dashboard/institutional/clearances">View my requests</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
            {(isSuperAdmin() || isHrAdmin()) && (
              <Card className="sm:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-[#1e3a5f] dark:text-sky-400" />
                    <CardTitle className="text-lg">Administrator</CardTitle>
                  </div>
                  <CardDescription>Overview, counts, and quick access to all institutional clearances.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link to="/dashboard/institutional/admin">Admin overview</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-lg">Requests trend</CardTitle>
              <CardDescription>Submitted, signed, and pending requests (last 6 months).</CardDescription>
            </CardHeader>
            <CardContent>
              {c.loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="submitted" name="Submitted" stroke="#2563eb" strokeWidth={2} />
                      <Line type="monotone" dataKey="signed" name="Signed" stroke="#10b981" strokeWidth={2} />
                      <Line type="monotone" dataKey="pending" name="Pending" stroke="#f59e0b" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60 rounded-xl shadow-sm overflow-hidden bg-card">
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-base font-semibold">Request progress</CardTitle>
              <CardDescription className="text-xs">
                Completion rate across submitted requests
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              {progressTotal === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No submitted requests yet.</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="h-[140px] w-full sm:w-[140px] shrink-0 flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={progressChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius="55%"
                          outerRadius="90%"
                          dataKey="value"
                          stroke="none"
                        >
                          {progressChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-2xl font-bold text-foreground">{progressPct}%</span>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <label className="flex items-center gap-2.5 cursor-default">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center border-2 border-emerald-500 bg-emerald-500/10">
                        <span className="h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="text-sm font-medium text-foreground">Signed</span>
                      <span className="ml-auto font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 text-sm">
                        {overview.signed}/{progressTotal}
                      </span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-default">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center border-2 border-amber-500 bg-amber-500/10">
                        <span className="h-2 w-2 bg-amber-500" />
                      </span>
                      <span className="text-sm font-medium text-foreground">Pending</span>
                      <span className="ml-auto font-semibold tabular-nums text-amber-600 dark:text-amber-400 text-sm">
                        {overview.pending} left
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-lg">Recent requests</CardTitle>
              <CardDescription>Your latest submitted forms and their status.</CardDescription>
            </CardHeader>
            <CardContent>
              {c.loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : recentRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requests yet. Create your first request.</p>
              ) : (
                <div className="space-y-2">
                  {recentRows.map((r) => (
                    <Link
                      key={r.id}
                      to={`/dashboard/institutional/clearances/${r.id}`}
                      className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 hover:bg-muted/40"
                    >
                      <span className="text-sm font-medium text-foreground">{r.fullName}</span>
                      <span className="text-xs capitalize text-muted-foreground">{r.status.replace(/_/g, ' ')}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
