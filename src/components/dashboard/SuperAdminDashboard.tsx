import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  FileText,
  CheckCircle,
  Clock,
  Shield,
  Plus,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardStats {
  totalStudents: number;
  totalSignatories: number;
  totalClearances: number;
  pendingClearances: number;
  approvedClearances: number;
}

interface RecentActivity {
  id: string;
  type: 'clearance' | 'signature';
  title: string;
  description: string;
  created_at: string;
  status: string;
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalSignatories: 0,
    totalClearances: 0,
    pendingClearances: 0,
    approvedClearances: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch counts
      const [profilesRes, signatoriesRes, clearancesRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('signatories').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('clearance_requests').select('id, status', { count: 'exact' }),
      ]);

      const clearances = clearancesRes.data || [];
      const pendingCount = clearances.filter((c) => c.status === 'pending').length;
      const approvedCount = clearances.filter((c) => c.status === 'approved').length;

      setStats({
        totalStudents: profilesRes.count || 0,
        totalSignatories: signatoriesRes.count || 0,
        totalClearances: clearancesRes.count || 0,
        pendingClearances: pendingCount,
        approvedClearances: approvedCount,
      });

      // Fetch recent clearance requests
      const { data: recentClearances } = await supabase
        .from('clearance_requests')
        .select(`
          id,
          title,
          status,
          created_at,
          profiles:student_id(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      const activities: RecentActivity[] = (recentClearances || []).map((c) => ({
        id: c.id,
        type: 'clearance' as const,
        title: c.title,
        description: `by ${(c.profiles as unknown as { full_name: string })?.full_name || 'Unknown'}`,
        created_at: c.created_at,
        status: c.status,
      }));

      setRecentActivity(activities);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    trend,
  }: {
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
    trend?: string;
  }) => (
    <Card className="shadow-card hover:shadow-elevated transition-shadow duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-display font-bold mt-1">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 mt-2 text-success text-sm">
                <TrendingUp className="h-4 w-4" />
                <span>{trend}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="pending">Pending</Badge>;
      case 'in_progress':
        return <Badge variant="in-progress">In Progress</Badge>;
      case 'approved':
        return <Badge variant="approved">Approved</Badge>;
      case 'rejected':
        return <Badge variant="rejected">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">System overview and management</p>
        </div>
        <Button
          variant="hero"
          size="lg"
          onClick={() => navigate('/dashboard/signatories')}
        >
          <Users className="h-5 w-5 mr-2" />
          Manage Signatories
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Total Students"
          value={stats.totalStudents}
          icon={Users}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          title="Active Signatories"
          value={stats.totalSignatories}
          icon={Shield}
          color="bg-secondary/10 text-secondary"
        />
        <StatCard
          title="Total Clearances"
          value={stats.totalClearances}
          icon={FileText}
          color="bg-accent text-accent-foreground"
        />
        <StatCard
          title="Pending"
          value={stats.pendingClearances}
          icon={Clock}
          color="bg-warning/10 text-warning"
        />
        <StatCard
          title="Approved"
          value={stats.approvedClearances}
          icon={CheckCircle}
          color="bg-success/10 text-success"
        />
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/dashboard/signatories')}
            >
              <Plus className="h-4 w-4 mr-3" />
              Add New Signatory
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/dashboard/settings')}
            >
              <Shield className="h-4 w-4 mr-3" />
              System Settings
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display">Recent Activity</CardTitle>
            <CardDescription>Latest clearance submissions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground mt-2">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors animate-slide-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.description} •{' '}
                          {new Date(activity.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(activity.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
