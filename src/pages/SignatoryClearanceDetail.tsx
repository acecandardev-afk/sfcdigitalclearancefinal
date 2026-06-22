import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { safeActionErrorMessage } from '@/lib/userFacingError';
import { friendlyApiErrorMessage, userErrorFromApi } from '@/lib/userMessages';
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
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filesViewerOpen, setFilesViewerOpen] = useState(false);
  const [studentOfficeNote, setStudentOfficeNote] = useState<string | null>(null);
  const [pendingOffice, setPendingOffice] = useState<{ fulfillment_id: string; label: string }[]>([]);
  const [verifiedOffice, setVerifiedOffice] = useState<
    { fulfillment_id: string; label: string; notes: string | null; verified_at: string | null }[]
  >([]);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<{ fulfillment_id: string; label: string } | null>(null);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    if (user && id) {
      fetchClearanceDetail();
    }
  }, [user, id]);

  const fetchClearanceDetail = async () => {
    if (!id || !user) return;
    try {
      const res = await fetch(`/api/clearances/${id}`, { credentials: 'include' });
      if (res.status === 404) {
        toast.error('Request not found. You may not have access or it was removed.');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(await friendlyApiErrorMessage(res, 'Could not load this request.'));
      const json = await res.json();

      setClearance(json.clearance as ClearanceDetail);
      const processedSignatures = (json.signatures || []) as Signature[];
      setSignatures(processedSignatures);
      setStudentOfficeNote((json.step_note as string | null) ?? null);

      const mySig = processedSignatures.find((s) => s.signatory_id === json.signatory_id);
      setMySignature(mySig || null);

      const po = (json.pending_office_verifications ?? []) as {
        signature_id: string;
        fulfillment_id: string;
        label: string;
      }[];
      const mine = mySig ? po.filter((p) => p.signature_id === mySig.id) : [];
      setPendingOffice(mine.map((p) => ({ fulfillment_id: p.fulfillment_id, label: p.label })));

      const vo = (json.verified_office_requirements ?? []) as {
        signature_id: string;
        fulfillment_id: string;
        label: string;
        notes: string | null;
        verified_at: string | null;
      }[];
      const mineVerified = mySig ? vo.filter((p) => p.signature_id === mySig.id) : [];
      setVerifiedOffice(
        mineVerified.map((p) => ({
          fulfillment_id: p.fulfillment_id,
          label: p.label,
          notes: p.notes,
          verified_at: p.verified_at,
        }))
      );

      if (mySig && mySig.status === 'pending') {
        const isAuthority = mySig.signatory_group === 'authority' && mySig.authority_sequence_order != null;
        if (isAuthority) {
          const prevAuthority = processedSignatures.filter(
            (s) =>
              s.signatory_group === 'authority' &&
              s.authority_sequence_order != null &&
              (s.authority_sequence_order ?? 0) < (mySig.authority_sequence_order ?? 0)
          );
          setCanSign(prevAuthority.every((s) => s.status === 'approved'));
        } else {
          setCanSign(true);
        }
      } else {
        setCanSign(false);
      }
    } catch (error) {
      console.error('Error fetching clearance:', error);
      toast.error(safeActionErrorMessage(error, 'Could not load this request.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (type: 'approve' | 'reject') => {
    setActionType(type);
    setRemarks('');
    setDialogOpen(true);
  };

  const submitAction = async () => {
    if (!mySignature || !id) return;
    if (!remarks.trim()) {
      toast.error('Remarks are required');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/clearance/sign', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_id: mySignature.id,
          action: actionType,
          remarks: remarks.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(userErrorFromApi(json, 'Could not save your decision. Please try again.'));

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

  const openVerifyDialog = (fulfillmentId: string, label: string) => {
    setVerifyTarget({ fulfillment_id: fulfillmentId, label });
    setVerifyNotes('');
    setVerifyDialogOpen(true);
  };

  const submitOfficeVerification = async () => {
    if (!verifyTarget) return;
    if (!verifyNotes.trim()) {
      toast.error('Verification notes are required');
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch('/api/clearance/office-requirement-verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fulfillment_id: verifyTarget.fulfillment_id, notes: verifyNotes.trim() }),
      });
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(userErrorFromApi(raw, 'Could not verify that requirement.'));
      toast.success('Office requirement verified');
      setVerifyDialogOpen(false);
      void fetchClearanceDetail();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not verify'));
    } finally {
      setVerifyLoading(false);
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
      <div className="w-full min-w-0 space-y-6 p-6 sm:px-6 lg:px-8">
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

              {mySignature?.status === 'pending' && pendingOffice.length > 0 ? (
                <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 space-y-3">
                  <p className="text-sm font-medium">Office verification</p>
                  <p className="text-xs text-muted-foreground">
                    Confirm in-office checks before signing off.
                  </p>
                  <ul className="space-y-2">
                    {pendingOffice.map((p) => (
                      <li key={p.fulfillment_id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm">{p.label}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => openVerifyDialog(p.fulfillment_id, p.label)}
                        >
                          Mark verified
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {verifiedOffice.length > 0 ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2">
                  <p className="text-sm font-medium">Verified office requirements</p>
                  <ul className="space-y-2 text-sm">
                    {verifiedOffice.map((p) => (
                      <li key={p.fulfillment_id}>
                        <p className="font-medium">{p.label}</p>
                        {p.notes ? (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">{p.notes}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

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
                  ? 'You are about to sign this clearance request. Enter required remarks below, then confirm.'
                  : 'Provide remarks explaining why this request is being rejected.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Remarks (required)</Label>
                <Textarea
                  placeholder={
                    actionType === 'approve'
                      ? 'Enter remarks for the student...'
                      : 'Explain why this request is being rejected...'
                  }
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Remarks will be displayed on the student&apos;s request record.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button onClick={submitAction} disabled={actionLoading || !remarks.trim()}>
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

        <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Verify office requirement</DialogTitle>
              <DialogDescription>
                Confirm documents are in order for: {verifyTarget?.label ?? 'this requirement'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Verification notes (required)</Label>
              <Textarea
                placeholder="Describe what was checked in office..."
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVerifyDialogOpen(false)} disabled={verifyLoading}>
                Cancel
              </Button>
              <Button onClick={submitOfficeVerification} disabled={verifyLoading || !verifyNotes.trim()}>
                {verifyLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Confirm verified'
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
