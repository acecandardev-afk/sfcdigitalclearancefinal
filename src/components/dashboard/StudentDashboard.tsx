import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import ClearanceProgressTimeline from '@/components/clearance/ClearanceProgressTimeline';
import StudentClearanceInsights from '@/components/dashboard/StudentClearanceInsights';
import { TERMS, getStatusLabel } from '@/lib/terms';

interface SignatureInfo {
  id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  sequence_order: number;
  signed_at: string | null;
  signatories: {
    id: string;
    name: string;
    position: string;
    department: string;
  };
}

interface ClearanceRequest {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  created_at: string;
  signatures_count?: number;
  approved_count?: number;
  clearance_signatures?: SignatureInfo[];
}

type StatusFilter = 'all' | 'pending' | 'approved';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clearances, setClearances] = useState<ClearanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    if (user) {
      fetchClearances();
    }
  }, [user]);

  const fetchClearances = async () => {
    try {
      const { data, error } = await supabase
        .from('clearance_requests')
        .select(`
          *,
          clearance_signatures(id, status, sequence_order, signed_at, signatories(id, name, position, department))
        `)
        .eq('student_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedData = data.map((item) => {
        // Sort signatures by sequence_order
        const sortedSignatures = [...(item.clearance_signatures || [])].sort(
          (a, b) => a.sequence_order - b.sequence_order
        );
        return {
          ...item,
          clearance_signatures: sortedSignatures,
          signatures_count: item.clearance_signatures?.length || 0,
          approved_count: item.clearance_signatures?.filter((s: { status: string }) => s.status === 'approved').length || 0,
        };
      });

      setClearances(processedData);

      // Calculate stats
      const pending = processedData.filter((c) => c.status === 'pending').length;
      const inProgress = processedData.filter((c) => c.status === 'in_progress').length;
      const approved = processedData.filter((c) => c.status === 'approved').length;
      const rejected = processedData.filter((c) => c.status === 'rejected').length;

      setStats({
        total: processedData.length,
        pending,
        inProgress,
        approved,
        rejected,
      });
    } catch (error) {
      console.error('Error fetching clearances:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="pending">{TERMS.PENDING}</Badge>;
      case 'in_progress':
        return <Badge variant="in-progress">{TERMS.IN_PROGRESS}</Badge>;
      case 'approved':
        return <Badge variant="approved">{TERMS.APPROVED}</Badge>;
      case 'rejected':
        return <Badge variant="rejected">{TERMS.REJECTED}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
  }: {
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
  }) => (
    <Card className="border border-border/60 rounded-xl shadow-sm bg-card/80 hover:shadow-md hover:border-primary/15 transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-display font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const filteredClearances = clearances.filter((c) => {
    if (statusFilter === 'all') return true;
    return c.status === statusFilter;
  });

  // Signatory progress: Signed vs Pending (exclude rejected, in_progress)
  const signatoryProgress = (() => {
    let signed = 0;
    let pending = 0;
    for (const c of clearances) {
      for (const sig of c.clearance_signatures || []) {
        if (sig.status === 'approved') signed++;
        else if (sig.status === 'pending') pending++;
      }
    }
    const total = signed + pending;
    const pct = total > 0 ? Math.round((signed / total) * 100) : 0;
    return { signed, pending, total, pct };
  })();

  const progressChartData = signatoryProgress.total > 0
    ? [
        { name: 'Signed', value: signatoryProgress.signed, fill: '#10b981' },
        { name: 'Pending', value: signatoryProgress.pending, fill: '#eab308' },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="app-page space-y-8 min-h-screen bg-gradient-to-br from-slate-50/80 via-blue-50/20 to-transparent dark:from-gray-950/50 dark:via-gray-900/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/50">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-[#1a3c5e] dark:text-blue-400">
            Student overview
          </h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-xl">
            Use <span className="font-medium text-foreground">My Clearance</span> to submit each office step; this page
            summarizes your requests.
          </p>
        </div>
        <Button
          onClick={() => navigate('/dashboard/clearances')}
          className="shrink-0 shadow-sm bg-[#1a3c5e] hover:bg-[#15304d] dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          My Clearance
        </Button>
      </div>

      {!loading && <StudentClearanceInsights clearances={clearances} />}

      {/* Signatory Progress */}
      {signatoryProgress.total > 0 && (
        <Card className="border border-border/50 rounded-xl shadow-sm overflow-hidden bg-card">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-base font-semibold">Signatory Progress</CardTitle>
            <CardDescription className="text-xs">
              Completion rate across your clearance requests
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
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
                      paddingAngle={0}
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
                  <span className="text-2xl font-bold text-foreground">{signatoryProgress.pct}%</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <label className="flex items-center gap-2.5 cursor-default">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-none border-2 border-emerald-500 bg-emerald-500/10">
                    <span className="h-2 w-2 rounded-none bg-emerald-500" />
                  </span>
                  <span className="text-sm font-medium text-foreground">Signed</span>
                  <span className="ml-auto font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 text-sm">
                    {signatoryProgress.signed}/{signatoryProgress.total}
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-default">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-none border-2 border-amber-500 bg-amber-500/10">
                    <span className="h-2 w-2 rounded-none bg-amber-500" />
                  </span>
                  <span className="text-sm font-medium text-foreground">Pending</span>
                  <span className="ml-auto font-semibold tabular-nums text-amber-600 dark:text-amber-400 text-sm">
                    {signatoryProgress.pending} left
                  </span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        <StatCard
          title="Total Requests"
          value={stats.total}
          icon={FileText}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          title={TERMS.PENDING}
          value={stats.pending}
          icon={Clock}
          color="bg-warning/10 text-warning"
        />
        <StatCard
          title={TERMS.IN_PROGRESS}
          value={stats.inProgress}
          icon={Loader2}
          color="bg-secondary/10 text-secondary"
        />
        <StatCard
          title={TERMS.APPROVED}
          value={stats.approved}
          icon={CheckCircle}
          color="bg-success/10 text-success"
        />
      </div>

      {/* Clearances with Filter */}
      <Card className="border border-border/60 rounded-xl shadow-sm bg-card overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">My Requests</CardTitle>
              <CardDescription className="text-sm">Your clearance requests and their status</CardDescription>
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">{TERMS.PENDING}</TabsTrigger>
                <TabsTrigger value="approved">{TERMS.APPROVED}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredClearances.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                {clearances.length === 0 ? 'No requests yet' : 'No matching requests'}
              </h3>
              <p className="text-muted-foreground mt-2">
                {clearances.length === 0
                  ? 'Create your first request to get started'
                  : `No requests with "${getStatusLabel(statusFilter)}" status`}
              </p>
              {clearances.length === 0 && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate('/dashboard/clearances')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Open My Clearance
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClearances.map((clearance, index) => {
                const signatureSteps = (clearance.clearance_signatures || []).map((sig) => ({
                  id: sig.id,
                  status: sig.status,
                  sequence_order: sig.sequence_order,
                  signed_at: sig.signed_at,
                  signatory: {
                    name: sig.signatories?.name || 'Unknown',
                    department: sig.signatories?.department || '',
                    position: sig.signatories?.position || '',
                  },
                }));

                return (
                  <div
                    key={clearance.id}
                    className="p-4 rounded-xl border border-border/60 hover:bg-muted/40 transition-colors cursor-pointer"
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => navigate(`/dashboard/clearances/${clearance.id}`)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{clearance.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(clearance.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(clearance.status)}
                    </div>
                    {signatureSteps.length > 0 && (
                      <div className="ml-14 space-y-3">
                        <ClearanceProgressTimeline signatures={signatureSteps.map((s) => ({ ...s, signatory: { name: s.signatory.name, department: s.signatory.department } }))} compact clearanceId={clearance.id} />
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Signatories</p>
                          <div className="grid gap-1.5">
                            {signatureSteps.map((sig) => (
                              <div key={sig.id} className="flex items-center justify-between text-sm">
                                <span className="text-foreground">
                                  {sig.sequence_order}. {sig.signatory.name}
                                  <span className="text-muted-foreground ml-1">
                                    ({sig.signatory.position || sig.signatory.department})
                                  </span>
                                </span>
                                {sig.status === 'approved' ? (
                                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                                    Signed
                                    {sig.signed_at && (
                                      <span className="text-muted-foreground font-normal">
                                        {new Date(sig.signed_at).toLocaleDateString()}
                                      </span>
                                    )}
                                  </span>
                                ) : sig.status === 'rejected' ? (
                                  <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium">
                                    <XCircle className="h-3.5 w-3.5" />
                                    Rejected
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium">
                                    <Clock className="h-3.5 w-3.5" />
                                    Pending
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
