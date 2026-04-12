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
import ApprovedStamp from '@/components/clearance/ApprovedStamp';
import { TERMS } from '@/lib/terms';
import { postgrestErrorMessage, safeActionErrorMessage } from '@/lib/userFacingError';
import { logActivity } from '@/hooks/useActivityLog';
import { Separator } from '@/components/ui/separator';

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
  signatory_group?: 'standard' | 'authority';
  authority_sequence_order?: number | null;
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
    address?: string | null;
    age?: number | null;
    email: string;
  };
}

type RawSignatorySignatureRow = {
  id: string;
  signatory_id: string;
  status: Signature['status'];
  notes: string | null;
  remarks: string | null;
  sequence_order: number;
  signed_at: string | null;
  signatory_group?: 'standard' | 'authority';
  authority_sequence_order?: number | null;
  signatories: Signatory | null;
};

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
  const [studentOfficeNote, setStudentOfficeNote] = useState<string | null>(null);

  useEffect(() => {
    if (user && id) {
      fetchClearanceDetail();
    }
  }, [user, id]);

  const fetchClearanceDetail = async () => {
    if (!id || !user) return;
    try {
      // Get signatory ID for current user
      const { data: signatoryData } = await supabase
        .from('signatories')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Fetch clearance request (RLS: signatories see assigned, superadmins see all)
      const { data: clearanceData, error: clearanceError } = await supabase
        .from('clearance_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (clearanceError) {
        console.error('Clearance fetch error:', clearanceError);
        toast.error(postgrestErrorMessage(clearanceError));
        setLoading(false);
        return;
      }
      if (!clearanceData) {
        toast.error('Request not found. You may not have access or it was removed.');
        setLoading(false);
        return;
      }

      // Fetch student profile separately
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, student_id, course, year_level, address, age, email')
        .eq('id', clearanceData.student_id)
        .maybeSingle();

      const pRow = profileData as any;

      setClearance({
        ...clearanceData,
        student: pRow || {
          full_name: 'Unknown',
          student_id: null,
          course: null,
          year_level: null,
          address: null,
          age: null,
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
          signatory_group,
          authority_sequence_order,
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

      const processedSignatures = ((signaturesData || []) as any[]).map((sig: RawSignatorySignatureRow): Signature => {
        const { signatories, ...rest } = sig;
        return {
          ...rest,
          signatory: signatories ?? { id: '', name: '', position: '', department: '' },
        };
      });

      setSignatures(processedSignatures);

      // Find my signature and check if I can sign (hybrid sequence logic)
      if (signatoryData) {
        const { data: noteData } = await supabase
          .from('student_clearance_step_notes')
          .select('note')
          .eq('clearance_request_id', id)
          .eq('signatory_id', signatoryData.id)
          .maybeSingle();
        const n = (noteData?.note as string)?.trim();
        setStudentOfficeNote(n ? (noteData?.note as string) : null);

        const mySig = processedSignatures.find(
          (s: Signature) => s.signatory_id === signatoryData.id
        );
        setMySignature(mySig || null);

        if (mySig && mySig.status === 'pending') {
          const isAuthority = mySig.signatory_group === 'authority' && mySig.authority_sequence_order != null;
          if (isAuthority) {
            // Authority: must wait for all previous authority signatories (by authority_sequence_order)
            const prevAuthority = processedSignatures.filter(
              (s: Signature) =>
                s.signatory_group === 'authority' &&
                s.authority_sequence_order != null &&
                (s.authority_sequence_order ?? 0) < (mySig.authority_sequence_order ?? 0)
            );
            setCanSign(prevAuthority.every((s: Signature) => s.status === 'approved'));
          } else {
            // Standard: flexible order - can sign anytime
            setCanSign(true);
          }
        } else {
          setCanSign(false);
        }
      } else {
        setStudentOfficeNote(null);
      }
    } catch (error) {
      console.error('Error fetching clearance:', error);
      toast.error(safeActionErrorMessage(error, 'Failed to load request details'));
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
    if (!mySignature || !id) return;

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

      void logActivity({
        action: actionType === 'approve' ? 'sign_clearance' : 'reject_clearance',
        details: {
          clearance_request_id: id,
          signatory_id: mySignature.signatory_id,
          signature_id: mySignature.id,
        },
      });

      toast.success(
        `Request ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`
      );
      setDialogOpen(false);
      fetchClearanceDetail();
    } catch (error) {
      console.error('Error updating signature:', error);
      toast.error(safeActionErrorMessage(error, 'Could not save your decision. Please try again.'));
    } finally {
      setActionLoading(false);
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
        <div className="text-center py-12 px-4">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Request not found</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            This request may have been removed, or you may not have access to it. Check your To Sign list for requests assigned to you.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Button variant="outline" onClick={() => navigate('/dashboard/requests')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              To Sign
            </Button>
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold">Clearance Signing</h1>
            <p className="text-muted-foreground">Review student details and attachments before signing</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="shadow-card lg:col-span-2 overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="font-display flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Clearance Request
              </CardTitle>
              <CardDescription>{clearance.title}</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant={
                    clearance.status === 'approved'
                      ? 'approved'
                      : clearance.status === 'rejected'
                        ? 'rejected'
                        : 'pending'
                  }
                >
                  {clearance.status.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Submitted {new Date(clearance.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Student</p>
                <p className="text-xl font-semibold mt-1 truncate">{clearance.student.full_name}</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Student ID</div>
                  <div className="font-medium text-foreground">{clearance.student.student_id || '—'}</div>
                  <div className="text-muted-foreground">Course</div>
                  <div className="font-medium text-foreground">{clearance.student.course || '—'}</div>
                  <div className="text-muted-foreground">Year level</div>
                  <div className="font-medium text-foreground">{clearance.student.year_level || '—'}</div>
                  <div className="text-muted-foreground">Age</div>
                  <div className="font-medium text-foreground">{clearance.student.age ?? '—'}</div>
                  <div className="text-muted-foreground">Address</div>
                  <div className="font-medium text-foreground">{clearance.student.address || '—'}</div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Purpose / Message</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{clearance.description || '—'}</p>
              </div>

              {studentOfficeNote ? (
                <div className="rounded-xl border border-border/60 bg-amber-500/5 p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Student note to your office</p>
                  <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{studentOfficeNote}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display">Signing Panel</CardTitle>
              <CardDescription>Attachments and signing actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-medium">Attachments</p>
                <p className="text-xs text-muted-foreground mt-1">Preview student uploads before signing.</p>
                <Button variant="outline" className="w-full mt-3" onClick={() => setFilesViewerOpen(true)}>
                  <Paperclip className="h-4 w-4 mr-2" />
                  View submitted documents
                </Button>
              </div>

              {!mySignature ? (
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                  You are not assigned to sign this request.
                </div>
              ) : mySignature.status !== 'pending' ? (
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-sm">
                  <p className="font-medium">Decision recorded</p>
                  <p className="text-muted-foreground mt-1">Status: {mySignature.status.toUpperCase()}</p>
                </div>
              ) : canSign ? (
                <div className="space-y-2">
                  <Button className="w-full" onClick={() => handleAction('approve')}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Sign / Approve
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={() => handleAction('reject')}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Lock className="h-4 w-4 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-medium">Signing locked</p>
                      <p className="text-muted-foreground mt-1">Previous authority signatories must approve before you can sign.</p>
                    </div>
                  </div>
                </div>
              )}

              <Separator />
              <div className="text-xs text-muted-foreground">Tip: Use “Preview” to check documents inside the system.</div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">
                {actionType === 'approve' ? 'Confirm Sign' : 'Reject Request'}
              </DialogTitle>
              <DialogDescription>
                {actionType === 'approve'
                  ? 'You are about to sign this clearance request. Add optional notes below, then confirm.'
                  : 'Provide a reason for declining this request.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder={
                    actionType === 'approve'
                      ? 'Add any notes for the student...'
                      : 'Explain why this request is being rejected...'
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Remarks (optional)</Label>
                <Textarea
                  placeholder="Add any remarks that will be visible on the request..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Remarks will be displayed on the student's request record.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button onClick={submitAction} disabled={actionLoading}>
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Confirm'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ClearanceFilesViewer
          clearanceRequestId={clearance.id}
          clearanceTitle={clearance.title}
          studentName={clearance.student.full_name}
          open={filesViewerOpen}
          onOpenChange={setFilesViewerOpen}
        />
      </div>
    </DashboardLayout>
  );
}
