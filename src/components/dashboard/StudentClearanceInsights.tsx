import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Layers } from 'lucide-react';
import { TERMS } from '@/lib/terms';

interface ClearanceLike {
  created_at: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
}

interface StudentClearanceInsightsProps {
  clearances: ClearanceLike[];
}

const PRIMARY = 'hsl(262 52% 42%)';

function sameMonth(a: Date, y: number, m: number) {
  return a.getFullYear() === y && a.getMonth() === m;
}

export default function StudentClearanceInsights({ clearances }: StudentClearanceInsightsProps) {
  const { monthlyStacked, activitySeries } = useMemo(() => {
    const now = new Date();
    const months: {
      key: string;
      label: string;
      y: number;
      m: number;
      pending: number;
      inProgress: number;
      approved: number;
      rejected: number;
      total: number;
    }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      months.push({
        key: `${y}-${m}`,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        y,
        m,
        pending: 0,
        inProgress: 0,
        approved: 0,
        rejected: 0,
        total: 0,
      });
    }

    for (const c of clearances) {
      const cd = new Date(c.created_at);
      const bucket = months.find((b) => sameMonth(cd, b.y, b.m));
      if (!bucket) continue;
      bucket.total += 1;
      if (c.status === 'pending') bucket.pending += 1;
      else if (c.status === 'in_progress') bucket.inProgress += 1;
      else if (c.status === 'approved') bucket.approved += 1;
      else if (c.status === 'rejected') bucket.rejected += 1;
    }

    const monthlyStacked = months.map((b) => ({
      name: b.label,
      [TERMS.PENDING]: b.pending,
      [TERMS.IN_PROGRESS]: b.inProgress,
      [TERMS.APPROVED]: b.approved,
      [TERMS.REJECTED]: b.rejected,
    }));

    const activitySeries = months.map((b) => ({
      name: b.label,
      submissions: b.total,
    }));

    return { monthlyStacked, activitySeries };
  }, [clearances]);

  const hasAny = clearances.length > 0;

  const tipStyle = {
    borderRadius: 8,
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--popover))',
    fontSize: 12,
    boxShadow: '0 8px 24px -4px hsl(220 15% 12% / 0.12)',
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Activity — area + gradient */}
      <Card className="xl:col-span-3 border border-border/60 rounded-xl shadow-sm bg-card overflow-hidden">
        <CardHeader className="pb-2 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Submission activity</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Requests created per month (last 6 months)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-2">
          <div className="h-[280px] w-full">
            {hasAny ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activitySeries} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillSubmissions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={36}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tipStyle}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                    formatter={(value: number | string) => [value, 'Submissions']}
                  />
                  <Area
                    type="monotone"
                    dataKey="submissions"
                    name="Submissions"
                    stroke={PRIMARY}
                    strokeWidth={2}
                    fill="url(#fillSubmissions)"
                    dot={{ r: 3, fill: PRIMARY, strokeWidth: 0 }}
                    activeDot={{ r: 5, stroke: PRIMARY, strokeWidth: 2, fill: 'hsl(var(--background))' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                No submissions yet — your timeline will appear here.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status mix — stacked bars */}
      <Card className="xl:col-span-2 border border-border/60 rounded-xl shadow-sm bg-card overflow-hidden">
        <CardHeader className="pb-2 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Status mix by month</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                How each month&apos;s requests break down
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-2">
          <div className="h-[280px] w-full">
            {hasAny ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyStacked} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={32}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tipStyle} labelStyle={{ fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey={TERMS.PENDING} stackId="s" fill="hsl(38 92% 50%)" radius={[0, 0, 0, 0]} maxBarSize={48} />
                  <Bar dataKey={TERMS.IN_PROGRESS} stackId="s" fill="hsl(262 40% 55%)" radius={[0, 0, 0, 0]} maxBarSize={48} />
                  <Bar dataKey={TERMS.APPROVED} stackId="s" fill="hsl(142 70% 42%)" radius={[0, 0, 0, 0]} maxBarSize={48} />
                  <Bar
                    dataKey={TERMS.REJECTED}
                    stackId="s"
                    fill="hsl(var(--destructive))"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                No data to stack yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
