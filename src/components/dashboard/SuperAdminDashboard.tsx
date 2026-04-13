import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import {
  Users,
  UserPlus,
  FileText,
  CheckCircle,
  Clock,
  Shield,
  Plus,
  Loader2,
  ListOrdered,
  ChevronRight,
  UserX,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { TERMS, getStatusLabel } from '@/lib/terms';

interface DashboardStats {
  totalStudents: number;
  totalSignatories: number;
  totalClearances: number;
  pendingClearances: number;
  approvedClearances: number;
  rejectedClearances: number;
  inProgressClearances: number;
  studentsLacking: number;
  studentsFullySigned: number;
  studentsNotSubmitted: number;
  /** Active clearance with at least one office submitted, not yet “almost done” */
  studentsInProgress: number;
  /** ≥90% of submitted offices approved, at least one still pending */
  studentsNearComplete: number;
}

interface StatusBreakdown {
  name: string;
  value: number;
  color: string;
}

interface StudentProgressBreakdown {
  name: string;
  value: number;
  color: string;
  description: string;
}

interface RecentActivity {
  id: string;
  type: 'clearance' | 'signature';
  title: string;
  description: string;
  created_at: string;
  status: string;
}

interface DayData {
  date: string;
  submissions: number;
  approvals: number;
  pending: number;
  in_progress: number;
  approved: number;
  rejected: number;
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalSignatories: 0,
    totalClearances: 0,
    pendingClearances: 0,
    approvedClearances: 0,
    rejectedClearances: 0,
    inProgressClearances: 0,
    studentsLacking: 0,
    studentsFullySigned: 0,
    studentsNotSubmitted: 0,
    studentsInProgress: 0,
    studentsNearComplete: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [progressionData, setProgressionData] = useState<DayData[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [studentProgressBreakdown, setStudentProgressBreakdown] = useState<StudentProgressBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard/superadmin', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const json = await res.json();

      setStats(json.stats);
      setStatusBreakdown(json.statusBreakdown || []);
      setStudentProgressBreakdown(json.studentProgressBreakdown || []);
      setRecentActivity(json.recentActivity || []);
      setProgressionData(json.progressionData || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const completionRate = stats.totalStudents > 0
    ? Math.round((stats.studentsFullySigned / stats.totalStudents) * 100)
    : 0;

  const StatCard = ({
    title,
    value,
    description,
    icon: Icon,
    color,
  }: {
    title: string;
    value: number;
    description?: string;
    icon: React.ElementType;
    color: string;
  }) => (
    <Card className="group border border-border/50 bg-card rounded-xl shadow-sm hover:shadow-md hover:border-border/80 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-2 tabular-nums tracking-tight">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{description}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl shrink-0 ${color} transition-transform duration-300 group-hover:scale-105`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="pending" className="font-medium">{TERMS.PENDING}</Badge>;
      case 'in_progress':
        return <Badge variant="in-progress" className="font-medium">{TERMS.IN_PROGRESS}</Badge>;
      case 'approved':
        return <Badge variant="approved" className="font-medium">{TERMS.APPROVED}</Badge>;
      case 'rejected':
        return <Badge variant="rejected" className="font-medium">{TERMS.REJECTED}</Badge>;
      default:
        return <Badge variant="outline" className="font-medium">{status}</Badge>;
    }
  };

  const quickActions = [
    { label: 'Create Student Account', icon: UserPlus, path: '/dashboard/students' },
    { label: 'Reports & export', icon: BarChart3, path: '/dashboard/reports' },
    { label: TERMS.ADD_SIGNATORY, icon: Plus, path: '/dashboard/signatories' },
    { label: TERMS.SET_SIGNATORY_ORDER, icon: ListOrdered, path: '/dashboard/signatories' },
    { label: 'System Settings', icon: Shield, path: '/dashboard/settings' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 lg:p-8">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="w-full p-6 lg:p-8 xl:p-10">
      {/* Page header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-foreground tracking-tight">
            Administrator Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-base">
            Overview of the Digital Clearance System for Saint Francis College — Guihulngan
          </p>
        </div>
        <Button
          onClick={() => navigate('/dashboard/signatories')}
          className="shrink-0 rounded-xl shadow-sm"
        >
          <Users className="h-4 w-4 mr-2" />
          {TERMS.MANAGE_SIGNATORIES}
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5 mb-8">
        <StatCard
          title="Total Students"
          value={stats.totalStudents}
          description="Total enrolled students in the system"
          icon={Users}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          title={TERMS.COMPLETED}
          value={stats.studentsFullySigned}
          description="Students with a fully approved clearance"
          icon={CheckCircle}
          color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Not started"
          value={stats.studentsNotSubmitted}
          description="No office submissions on their current active request"
          icon={UserX}
          color="bg-slate-500/10 text-slate-600 dark:text-slate-400"
        />
        <StatCard
          title="In progress"
          value={stats.studentsInProgress}
          description="Waiting on approvals for submitted offices"
          icon={Clock}
          color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        <StatCard
          title="Almost done"
          value={stats.studentsNearComplete}
          description="90%+ of submitted offices already approved"
          icon={CheckCircle}
          color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Active Signatories"
          value={stats.totalSignatories}
          description="Personnel authorized to sign student requests"
          icon={Shield}
          color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title={TERMS.PENDING}
          value={stats.pendingClearances}
          description="Clearance requests in pending status"
          icon={Clock}
          color="bg-orange-500/10 text-orange-600 dark:text-orange-400"
        />
        <StatCard
          title={TERMS.COMPLETED_REQUESTS}
          value={stats.approvedClearances}
          description="Clearance requests marked approved"
          icon={CheckCircle}
          color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* Student Progress Overview - main analytics */}
      <Card className="border border-border/50 rounded-xl shadow-sm overflow-hidden mb-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            Student Progress Overview
          </CardTitle>
          <CardDescription>
            Breakdown of {stats.totalStudents} students by real clearance activity: completed, not started, in progress,
            and almost done (90%+ of offices they submitted to are approved). Totals use live data from requests and
            signatures.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-[260px]">
              {studentProgressBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={studentProgressBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                    >
                      {studentProgressBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        backgroundColor: 'hsl(var(--card))',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number, _name: string, props: { payload: StudentProgressBreakdown }) => {
                        const pct = stats.totalStudents > 0 ? Math.round((value / stats.totalStudents) * 100) : 0;
                        return [`${value} students (${pct}%)`, props.payload.description];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No student data yet
                </div>
              )}
            </div>
            <div className="space-y-3">
              {studentProgressBreakdown.map((item) => {
                const pct = stats.totalStudents > 0 ? Math.round((item.value / stats.totalStudents) * 100) : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums">{item.value}</p>
                      <p className="text-xs text-muted-foreground">{pct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts row: Completion rate + Status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Completion rate radial */}
        <Card className="border border-border/50 rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              Student Completion Rate
            </CardTitle>
            <CardDescription>Percentage of students who have a fully approved clearance request</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="70%"
                  outerRadius="100%"
                  data={[
                    {
                      name: 'Completion',
                      value: completionRate,
                      fill: 'url(#completionGradient)',
                    },
                  ]}
                  startAngle={180}
                  endAngle={0}
                >
                  <defs>
                    <linearGradient id="completionGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <RadialBar background dataKey="value" cornerRadius={10} />
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-4xl font-bold fill-foreground"
                  >
                    {completionRate}%
                  </text>
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-2">
              {stats.studentsFullySigned} of {stats.totalStudents} students have completed clearance
            </p>
          </CardContent>
        </Card>

        {/* Status breakdown pie */}
        <Card className="border border-border/50 rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
              Request Status
            </CardTitle>
            <CardDescription>
              Distribution of requests by stage: Pending (awaiting first signatory), In Progress (being reviewed), Completed (signed by all), or Rejected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              {statusBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                    >
                      {statusBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        backgroundColor: 'hsl(var(--card))',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number, _name: string, props: { payload: StatusBreakdown }) => {
                        const pct = stats.totalClearances > 0 ? Math.round((value / stats.totalClearances) * 100) : 0;
                        return [`${value} (${pct}%)`, props.payload.name];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No clearance data yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progression area chart - enhanced */}
      <Card className="border border-border/50 rounded-xl shadow-sm mb-8">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Request Progression</CardTitle>
              <CardDescription className="text-muted-foreground/90">
                New submissions and completed approvals over the last 30 days. Use this to track activity trends.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={progressionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorApprovals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => format(new Date(v), 'MMM d')}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    backgroundColor: 'hsl(var(--card))',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 16 }}
                  formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
                />
                <Area
                  type="monotone"
                  dataKey="submissions"
                  name="Submitted"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  fill="url(#colorSubmissions)"
                />
                <Area
                  type="monotone"
                  dataKey="approvals"
                  name="Completed"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#colorApprovals)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Stacked bar chart - daily breakdown by status */}
      <Card className="border border-border/50 rounded-xl shadow-sm mb-8">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
            Daily Request Breakdown
          </CardTitle>
          <CardDescription>
            Number of requests in each status (Pending, In Progress, Completed, Rejected) per day for the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => format(new Date(v), 'MMM d')}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    backgroundColor: 'hsl(var(--card))',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 16 }}
                  formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
                />
                <Bar dataKey="approved" name={TERMS.APPROVED} stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="in_progress" name={TERMS.IN_PROGRESS} stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pending" name={TERMS.PENDING} stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="rejected" name={TERMS.REJECTED} stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-6">
        {/* Quick Actions */}
        <Card className="border border-border/50 bg-card rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/90">
              Common administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.path + action.label}
                  variant="outline"
                  className="w-full justify-between h-11 px-4 font-medium rounded-xl hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(action.path)}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {action.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-70" />
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border border-border/50 bg-card rounded-xl shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
                <CardDescription className="text-sm text-muted-foreground/90">
                  Latest clearance submissions
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:bg-primary/10 rounded-xl"
                onClick={() => navigate('/dashboard/reports')}
              >
                Reports
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-14 border border-dashed border-border/70 rounded-xl bg-muted/20">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground mt-3 text-sm font-medium">No recent activity</p>
                <p className="text-muted-foreground/80 text-xs mt-1">New requests will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((activity) => (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => navigate(`/dashboard/clearances/${activity.id}`)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-muted/40 hover:border-border/80 transition-all duration-200 text-left group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0 group-hover:bg-primary/15 transition-colors">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{activity.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {activity.description} · {new Date(activity.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 ml-4">
                      {getStatusBadge(activity.status)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
