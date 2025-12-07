import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Clock, CheckCircle, XCircle, FileText, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface PendingSignature {
  id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  notes: string | null;
  created_at: string;
  clearance_request: {
    id: string;
    title: string;
    description: string | null;
    created_at: string;
    profiles: {
      full_name: string;
      student_id: string | null;
      course: string | null;
      year_level: string | null;
    };
  };
}

export default function SignatoryDashboard() {
  const { user } = useAuth();
  const [signatures, setSignatures] = useState<PendingSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignature, setSelectedSignature] = useState<PendingSignature | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');

  useEffect(() => {
    if (user) {
      fetchPendingSignatures();
    }
  }, [user]);

  const fetchPendingSignatures = async () => {
    try {
      // First get the signatory record for the current user
      const { data: signatoryData, error: signatoryError } = await supabase
        .from('signatories')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (signatoryError || !signatoryData) {
        setLoading(false);
        return;
      }

      // Then fetch all signatures for this signatory
      const { data, error } = await supabase
        .from('clearance_signatures')
        .select(`
          *,
          clearance_request:clearance_requests(
            id,
            title,
            description,
            created_at,
            profiles:student_id(
              full_name,
              student_id,
              course,
              year_level
            )
          )
        `)
        .eq('signatory_id', signatoryData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSignatures(data as unknown as PendingSignature[]);
    } catch (error) {
      console.error('Error fetching signatures:', error);
      toast.error('Failed to load pending signatures');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (signature: PendingSignature, type: 'approve' | 'reject') => {
    setSelectedSignature(signature);
    setActionType(type);
    setNotes('');
    setDialogOpen(true);
  };

  const submitAction = async () => {
    if (!selectedSignature) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('clearance_signatures')
        .update({
          status: actionType === 'approve' ? 'approved' : 'rejected',
          notes: notes || null,
          signed_at: new Date().toISOString(),
        })
        .eq('id', selectedSignature.id);

      if (error) throw error;

      toast.success(`Clearance ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      setDialogOpen(false);
      fetchPendingSignatures();
    } catch (error) {
      console.error('Error updating signature:', error);
      toast.error('Failed to update signature');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="pending">Pending</Badge>;
      case 'approved':
        return <Badge variant="approved">Approved</Badge>;
      case 'rejected':
        return <Badge variant="rejected">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = signatures.filter((s) => s.status === 'pending').length;
  const approvedCount = signatures.filter((s) => s.status === 'approved').length;
  const rejectedCount = signatures.filter((s) => s.status === 'rejected').length;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold">Signatory Dashboard</h1>
        <p className="text-muted-foreground mt-1">Review and approve clearance requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-3xl font-display font-bold mt-1">{pendingCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-warning/10 text-warning">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-3xl font-display font-bold mt-1">{approvedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-success/10 text-success">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-3xl font-display font-bold mt-1">{rejectedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive">
                <XCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Clearance Requests</CardTitle>
          <CardDescription>Review and process student clearance requests</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : signatures.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No requests assigned</h3>
              <p className="text-muted-foreground mt-2">
                You don't have any clearance requests to review
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {signatures.map((signature, index) => (
                <div
                  key={signature.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors animate-slide-up gap-4"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{signature.clearance_request.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {signature.clearance_request.profiles.full_name}
                        {signature.clearance_request.profiles.student_id && (
                          <span className="ml-2">• {signature.clearance_request.profiles.student_id}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {signature.clearance_request.profiles.course} • {signature.clearance_request.profiles.year_level}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-12 sm:ml-0">
                    {getStatusBadge(signature.status)}
                    {signature.status === 'pending' && (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleAction(signature, 'approve')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleAction(signature, 'reject')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {actionType === 'approve' ? 'Approve' : 'Reject'} Clearance
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? 'Confirm approval of this clearance request.'
                : 'Provide a reason for rejecting this clearance request.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder={
                  actionType === 'approve'
                    ? 'Add any notes for the student...'
                    : 'Explain why this clearance is being rejected...'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'approve' ? 'success' : 'destructive'}
              onClick={submitAction}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : actionType === 'approve' ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {actionType === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
