import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, CheckCircle, Clock, XCircle, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';

interface Signature {
  id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  notes: string | null;
  signed_at: string | null;
  signatory: {
    name: string;
    position: string;
    department: string;
  };
}

interface ClearanceDetail {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export default function ClearanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clearance, setClearance] = useState<ClearanceDetail | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchClearanceDetail();
    }
  }, [user, id]);

  const fetchClearanceDetail = async () => {
    try {
      // Fetch clearance request
      const { data: clearanceData, error: clearanceError } = await supabase
        .from('clearance_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (clearanceError) throw clearanceError;
      if (!clearanceData) {
        toast.error('Clearance not found');
        navigate('/dashboard');
        return;
      }

      setClearance(clearanceData);

      // Fetch signatures with signatory details
      const { data: signaturesData, error: signaturesError } = await supabase
        .from('clearance_signatures')
        .select(`
          id,
          status,
          notes,
          signed_at,
          signatories (
            name,
            position,
            department
          )
        `)
        .eq('clearance_request_id', id);

      if (signaturesError) throw signaturesError;

      const processedSignatures = signaturesData.map((sig: any) => ({
        ...sig,
        signatory: sig.signatories,
      }));

      setSignatures(processedSignatures);
    } catch (error) {
      console.error('Error fetching clearance:', error);
      toast.error('Failed to load clearance details');
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-secondary animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-warning" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!clearance) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Clearance not found</h3>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold">{clearance.title}</h1>
              {getStatusBadge(clearance.status)}
            </div>
            <p className="text-muted-foreground mt-1">
              Submitted on{' '}
              {new Date(clearance.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Description */}
        {clearance.description && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{clearance.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Signatures */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Signatures</CardTitle>
            <CardDescription>
              {signatures.filter((s) => s.status === 'approved').length} of {signatures.length}{' '}
              signatures collected
            </CardDescription>
          </CardHeader>
          <CardContent>
            {signatures.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No signatures required</p>
            ) : (
              <div className="space-y-4">
                {signatures.map((sig) => (
                  <div
                    key={sig.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-muted rounded-full">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">{sig.signatory.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {sig.signatory.position} • {sig.signatory.department}
                        </p>
                        {sig.notes && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            "{sig.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusIcon(sig.status)}
                      {getStatusBadge(sig.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
