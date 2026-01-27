import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ClearanceProgressTimeline from '@/components/clearance/ClearanceProgressTimeline';

interface SignatureInfo {
  id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  sequence_order: number;
  signatories: {
    name: string;
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

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clearances, setClearances] = useState<ClearanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
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
          clearance_signatures(id, status, sequence_order, signatories(name, department))
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
      toast.error('Failed to load clearances');
    } finally {
      setLoading(false);
    }
  };

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
    <Card className="shadow-card hover:shadow-elevated transition-shadow duration-300">
      <CardContent className="p-6">
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

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your clearance requests</p>
        </div>
        <Button
          variant="hero"
          size="lg"
          onClick={() => navigate('/dashboard/clearances/new')}
        >
          <Plus className="h-5 w-5 mr-2" />
          New Clearance
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Requests"
          value={stats.total}
          icon={FileText}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon={Clock}
          color="bg-warning/10 text-warning"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={Loader2}
          color="bg-secondary/10 text-secondary"
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon={CheckCircle}
          color="bg-success/10 text-success"
        />
      </div>

      {/* Recent Clearances */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Recent Clearances</CardTitle>
          <CardDescription>Your latest clearance requests and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : clearances.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No clearances yet</h3>
              <p className="text-muted-foreground mt-2">
                Create your first clearance request to get started
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate('/dashboard/clearances/new')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Clearance
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {clearances.slice(0, 5).map((clearance, index) => {
                const signatureSteps = (clearance.clearance_signatures || []).map((sig) => ({
                  id: sig.id,
                  status: sig.status,
                  sequence_order: sig.sequence_order,
                  signatory: {
                    name: sig.signatories?.name || 'Unknown',
                    department: sig.signatories?.department || '',
                  },
                }));

                return (
                  <div
                    key={clearance.id}
                    className="p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer animate-slide-up"
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
                      <div className="ml-14">
                        <ClearanceProgressTimeline signatures={signatureSteps} compact />
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
