import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  User,
  Paperclip,
  Lock,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import ClearanceFilesViewer from '@/components/dashboard/ClearanceFilesViewer';

interface Signatory {
  id: string;
  name: string;
  position: string;
  department: string;
}

interface Signature {
  id: string;
  signatory_id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  notes: string | null;
  remarks: string | null;
  sequence_order: number;
  signed_at: string | null;
  signatory: Signatory;
}

interface ClearanceDetail {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  student: {
    full_name: string;
    student_id: string | null;
    course: string | null;
    year_level: string | null;
    email: string;
  };
}

export default function SignatoryClearanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clearance, setClearance] = useState<ClearanceDetail | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [mySignature, setMySignature] = useState<Signature | null>(null);
  const [canSign, setCanSign] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [notes, setNotes] = useState('');
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filesViewerOpen, setFilesViewerOpen] = useState(false);

  useEffect(() => {
    if (user && id) {
      fetchClearanceDetail();
    }
  }, [user, id]);

  const fetchClearanceDetail = async () => {
    try {
      // Get signatory ID for current user
      const { data: signatoryData } = await supabase
        .from('signatories')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

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

      // Fetch student profile separately
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, student_id, course, year_level, email')
        .eq('id', clearanceData.student_id)
        .maybeSingle();

      setClearance({
        ...clearanceData,
        student: profileData || {
          full_name: 'Unknown',
          student_id: null,
          course: null,
          year_level: null,
          email: '',
        },
      });

      // Fetch all signatures with signatory details
      const { data: signaturesData, error: signaturesError } = await supabase
        .from('clearance_signatures')
        .select(`
          id,
          signatory_id,
          status,
          notes,
          remarks,
          sequence_order,
          signed_at,
          signatories (
            id,
            name,
            position,
            department
          )
        `)
        .eq('clearance_request_id', id)
        .order('sequence_order', { ascending: true });

      if (signaturesError) throw signaturesError;

      const processedSignatures = signaturesData.map((sig: any) => ({
        ...sig,
        signatory: sig.signatories,
      }));

      setSignatures(processedSignatures);

      // Find my signature and check if I can sign
      if (signatoryData) {
        const mySig = processedSignatures.find(
          (s: Signature) => s.signatory_id === signatoryData.id
        );
        setMySignature(mySig || null);

        if (mySig && mySig.status === 'pending') {
          // Check if all previous signatures are approved
          const previousSigs = processedSignatures.filter(
            (s: Signature) => s.sequence_order < mySig.sequence_order
          );
          const allPreviousApproved = previousSigs.every(
            (s: Signature) => s.status === 'approved'
          );
          setCanSign(allPreviousApproved);
        } else {
          setCanSign(false);
        }
      }
    } catch (error) {
      console.error('Error fetching clearance:', error);
      toast.error('Failed to load clearance details');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (type: 'approve' | 'reject') => {
    setActionType(type);
    setNotes('');
    setRemarks('');
    setDialogOpen(true);
  };

  const submitAction = async () => {
    if (!mySignature) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('clearance_signatures')
        .update({
          status: actionType === 'approve' ? 'approved' : 'rejected',
          notes: notes || null,
          remarks: remarks || null,
          signed_at: new Date().toISOString(),
        })
        .eq('id', mySignature.id);

      if (error) throw error;

      toast.success(
        `Clearance ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`
      );
      setDialogOpen(false);
      fetchClearanceDetail();
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
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
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
          <Button variant="outline" onClick={() => setFilesViewerOpen(true)}>
            <Paperclip className="h-4 w-4 mr-2" />
            View Files
          </Button>
          {canSign && (
            <>
              <Button variant="success" onClick={() => handleAction('approve')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button variant="destructive" onClick={() => handleAction('reject')}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
        </div>

        {/* Student Info */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Student Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{clearance.student.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Student ID</p>
                <p className="font-medium">{clearance.student.student_id || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Course</p>
                <p className="font-medium">{clearance.student.course || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Year Level</p>
                <p className="font-medium">{clearance.student.year_level || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* My Signing Status */}
        {mySignature && (
          <Card className={`shadow-card ${canSign ? 'border-primary border-2' : ''}`}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Your Signing Status
                {!canSign && mySignature.status === 'pending' && (
                  <Lock className="h-4 w-4 text-warning" />
                )}
              </CardTitle>
              <CardDescription>
                {mySignature.status === 'pending' && !canSign
                  ? 'Waiting for previous signatories to approve'
                  : mySignature.status === 'pending'
                  ? 'This clearance is ready for your signature'
                  : `You ${mySignature.status} this clearance`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {getStatusIcon(mySignature.status)}
                {getStatusBadge(mySignature.status)}
                {mySignature.signed_at && (
                  <span className="text-sm text-muted-foreground">
                    on{' '}
                    {new Date(mySignature.signed_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
              {mySignature.remarks && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Your Remarks:</p>
                  <p className="text-sm text-muted-foreground">{mySignature.remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* All Signatures */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Signing History</CardTitle>
            <CardDescription>
              All signatories and their remarks for this clearance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {signatures.map((sig) => {
                const isMe = mySignature?.id === sig.id;
                const previousApproved = signatures
                  .filter((s) => s.sequence_order < sig.sequence_order)
                  .every((s) => s.status === 'approved');
                const isWaiting = sig.status === 'pending' && !previousApproved;

                return (
                  <div
                    key={sig.id}
                    className={`flex flex-col p-4 rounded-lg border ${
                      isMe ? 'border-primary bg-primary/5' : 'border-border'
                    } ${isWaiting ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          {sig.sequence_order}
                        </div>
                        <div className="p-2 bg-muted rounded-full">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{sig.signatory.name}</p>
                            {isMe && (
                              <Badge variant="outline" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {sig.signatory.position} • {sig.signatory.department}
                          </p>
                          {sig.signed_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Signed on{' '}
                              {new Date(sig.signed_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}
                          {isWaiting && (
                            <p className="text-xs text-warning mt-1 flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Waiting for previous signatories
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusIcon(sig.status)}
                        {getStatusBadge(sig.status)}
                      </div>
                    </div>

                    {/* Show remarks and notes */}
                    {(sig.remarks || sig.notes) && (
                      <div className="mt-4 pl-12 space-y-2">
                        {sig.remarks && (
                          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                            <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-primary">Remarks</p>
                              <p className="text-sm text-muted-foreground">{sig.remarks}</p>
                            </div>
                          </div>
                        )}
                        {sig.notes && (
                          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Notes</p>
                              <p className="text-sm text-muted-foreground">{sig.notes}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

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
            <div className="space-y-2">
              <Label>Remarks (visible to other signatories)</Label>
              <Textarea
                placeholder="Add remarks that will be visible to the student and other signatories..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Remarks are visible to everyone viewing this clearance.
              </p>
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

      {/* Files Viewer */}
      <ClearanceFilesViewer
        clearanceRequestId={clearance.id}
        clearanceTitle={clearance.title}
        studentName={clearance.student.full_name}
        open={filesViewerOpen}
        onOpenChange={setFilesViewerOpen}
      />
    </DashboardLayout>
  );
}
