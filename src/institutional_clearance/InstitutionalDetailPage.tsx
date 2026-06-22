import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Check, Eye, Info, Loader2, Lock, Pencil, Printer, Search, Shield, Archive, Upload } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { InstitutionalPageBrand } from '@/institutional_clearance/InstitutionalPageBrand';
import { parseResponseJson } from '@/lib/parseResponseJson';
import { userErrorFromApi } from '@/lib/userMessages';
import { safeActionErrorMessage } from '@/lib/userFacingError';
import { labelEmployeeType, labelReasonCategory } from '@/lib/institutionalOffices';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OfficeRequestModal } from '@/components/clearance/my-clearance/OfficeRequestModal';
import { requirementToOfficeUi } from '@/lib/signatoryRequirements';
import type { RequirementKind } from '@prisma/client';

type Cl = {
  id: string;
  requesterId: string;
  fullName: string;
  position: string;
  department: string;
  employeeType: string | null;
  dateOfSeparation: string | null;
  reasonCategory: string | null;
  reasonOtherDetails: string | null;
  reason: string | null;
  finalClearanceStatus: string | null;
  finalClearanceRemarks: string | null;
  status: string;
  createdAt: string;
  items: {
    id: string;
    signatoryId: string | null;
    departmentLabel: string;
    sortOrder: number;
    status: string;
    submissionRemarks: string | null;
    remarks: string | null;
    hasSubmission?: boolean;
    officeVerificationPending?: boolean;
    sequentialUnlocked?: boolean;
    requirements?: {
      id: number;
      kind: RequirementKind;
      label: string;
      instructions: string | null;
      required: boolean;
      sortOrder: number;
    }[];
    fulfillments?: {
      id: string;
      requirementId: number;
      kind: string;
      label: string;
      officeVerifiedAt: string | null;
      officeVerificationNotes: string | null;
    }[];
    approverName: string | null;
    approvedAt: string | null;
    signatory: {
      id: string;
      name: string;
      position: string;
      department: string;
    } | null;
  }[];
  certification: {
    preparedByName: string | null;
    preparedAt: string | null;
    verifiedByName: string | null;
    verifiedAt: string | null;
    approvedByName: string | null;
    approvedAt: string | null;
  } | null;
  certificationPermissions?: {
    canEditPrepared: boolean;
    canEditVerified: boolean;
    canEditApproved: boolean;
  };
  files?: {
    id: string;
    file_name: string;
    content_type: string | null;
    blob_url: string;
    uploaded_at: string;
  }[];
};

export default function InstitutionalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin, isSignatory } = useUserRole();
  const canSignOff = isSignatory() || isSuperAdmin();
  const isSuper = isSuperAdmin();
  const isSignatoryViewPath = location.pathname.startsWith('/dashboard/institutional/signatory/');
  const listPath = isSignatoryViewPath ? '/dashboard/institutional/pending' : '/dashboard/institutional/clearances';
  const isEmployeeRecordView = !isSignatoryViewPath;
  const printPath = isSignatoryViewPath
    ? `/dashboard/institutional/signatory/clearances/${id}/print`
    : `/dashboard/institutional/clearances/${id}/print`;
  const [c, setC] = useState<Cl | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowDraft, setRowDraft] = useState<Record<string, { remarks: string; approver: string }>>({});
  const [cert, setCert] = useState({
    preparedByName: '',
    preparedAt: '',
    verifiedByName: '',
    verifiedAt: '',
    approvedByName: '',
    approvedAt: '',
  });
  const [finalStatus, setFinalStatus] = useState<string>('');
  const [finalRemarks, setFinalRemarks] = useState('');
  const [fileBusy, setFileBusy] = useState(false);
  const [archiveFileId, setArchiveFileId] = useState<string | null>(null);
  const [section2Filter, setSection2Filter] = useState<'all' | 'pending' | 'approved' | 'waived' | 'rejected'>('all');
  const [section2Query, setSection2Query] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [submitItem, setSubmitItem] = useState<Cl['items'][number] | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<{
    itemId: string;
    fulfillmentId: string;
    label: string;
  } | null>(null);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/institutional/clearances/${id}`, { credentials: 'include' });
    const j = await parseResponseJson(res);
    if (!res.ok) {
      throw new Error(userErrorFromApi(j, 'Could not load this clearance.'));
    }
    const cl = j.clearance as Cl;
    setC(cl);
    const rd: typeof rowDraft = {};
    for (const it of cl.items) {
      rd[it.id] = { remarks: it.remarks || '', approver: it.approverName || '' };
    }
    setRowDraft(rd);
    if (cl.certification) {
      const toLocal = (s: string | null) => (s && s.length >= 16 ? s.slice(0, 16) : '');
      setCert({
        preparedByName: cl.certification.preparedByName || '',
        preparedAt: toLocal(cl.certification.preparedAt),
        verifiedByName: cl.certification.verifiedByName || '',
        verifiedAt: toLocal(cl.certification.verifiedAt),
        approvedByName: cl.certification.approvedByName || '',
        approvedAt: toLocal(cl.certification.approvedAt),
      });
    }
    setFinalStatus(cl.finalClearanceStatus || '');
    setFinalRemarks(cl.finalClearanceRemarks || '');
  }, [id]);

  const perms = c?.certificationPermissions;
  const canEditAnyCert =
    perms && (perms.canEditPrepared || perms.canEditVerified || perms.canEditApproved);

  useEffect(() => {
    let a = true;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch {
        if (a) toast.error('Could not load clearance');
      } finally {
        if (a) setLoading(false);
      }
    })();
    return () => {
      a = false;
    };
  }, [load]);

  const canEditHeader = c && user && c.requesterId === (user as { id?: string }).id;
  const isRequester = canEditHeader;

  const signOffRow = async (itemId: string, st: 'approved' | 'rejected' | 'waived' | 'pending') => {
    if (!id) return;
    const d = rowDraft[itemId] || { remarks: '', approver: '' };
    if ((st === 'approved' || st === 'rejected' || st === 'waived') && !d.remarks.trim()) {
      toast.error('Remarks are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/institutional/clearances/${id}/items/${itemId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: st,
          remarks: d.remarks,
          approverName: d.approver,
          setApproved: st === 'approved' || st === 'waived',
        }),
      });
      const j = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(
          userErrorFromApi(j, 'Could not update that office row.')
        );
      }
      toast.success('Row updated');
      await load();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not complete that action. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const submitInstitutionalOffice = async (payload: {
    note: string;
    files: File[];
    fulfillments?: { requirementId: number; documentFiles: File[]; physicalAttested?: boolean }[];
  }) => {
    if (!id || !submitItem) return;
    const { note, fulfillments } = payload;

    const uploadFile = async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'institutional-clearance');
      const up = await fetch('/api/blob/upload', { method: 'POST', body: fd, credentials: 'include' });
      const raw = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(userErrorFromApi(raw, 'Could not upload the file. Try again or use a smaller file.'));
      const j = raw as { blob_url?: string; file_name?: string; content_type?: string | null };
      if (!j.blob_url) throw new Error('The file upload did not finish. Try again or use a smaller file.');
      return {
        blob_url: j.blob_url,
        file_name: j.file_name ?? file.name,
        content_type: j.content_type ?? null,
      };
    };

    let fulfillmentsPayload:
      | { requirement_id: number; document_urls?: Awaited<ReturnType<typeof uploadFile>>[]; physical_attested?: boolean }[]
      | undefined;

    if (fulfillments?.length) {
      fulfillmentsPayload = [];
      for (const f of fulfillments) {
        const document_urls = [];
        for (const file of f.documentFiles) {
          document_urls.push(await uploadFile(file));
        }
        fulfillmentsPayload.push({
          requirement_id: f.requirementId,
          ...(document_urls.length ? { document_urls } : {}),
          ...(f.physicalAttested != null ? { physical_attested: f.physicalAttested } : {}),
        });
      }
    }

    const res = await fetch(
      `/api/institutional/clearances/${id}/items/${submitItem.id}/submit`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note,
          files: [],
          ...(fulfillmentsPayload ? { fulfillments: fulfillmentsPayload } : {}),
        }),
      }
    );
    const j = await parseResponseJson(res);
    if (!res.ok) {
      throw new Error(userErrorFromApi(j, 'Could not submit to that office.'));
    }
    toast.success('Office submitted');
    setSubmitItem(null);
    await load();
  };

  const openVerifyOffice = (itemId: string, fulfillmentId: string, label: string) => {
    setVerifyTarget({ itemId, fulfillmentId, label });
    setVerifyNotes('');
    setVerifyDialogOpen(true);
  };

  const submitOfficeVerification = async () => {
    if (!id || !verifyTarget) return;
    if (!verifyNotes.trim()) {
      toast.error('Verification notes are required');
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch(
        `/api/institutional/clearances/${id}/items/${verifyTarget.itemId}/verify-office`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fulfillment_id: verifyTarget.fulfillmentId, notes: verifyNotes.trim() }),
        }
      );
      const j = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(userErrorFromApi(j, 'Could not verify that requirement.'));
      }
      toast.success('Office requirement verified');
      setVerifyDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not verify'));
    } finally {
      setVerifyLoading(false);
    }
  };

  const saveCert = async () => {
    if (!id || !perms) return;
    setSaving(true);
    const toT = (s: string) => (s ? new Date(s).toISOString() : null);
    const body: Record<string, unknown> = {};
    if (perms.canEditPrepared) {
      body.preparedByName = cert.preparedByName || null;
      body.preparedAt = toT(cert.preparedAt) || (cert.preparedByName ? new Date().toISOString() : null);
    }
    if (perms.canEditVerified) {
      body.verifiedByName = cert.verifiedByName || null;
      body.verifiedAt = toT(cert.verifiedAt) || (cert.verifiedByName ? new Date().toISOString() : null);
    }
    if (perms.canEditApproved) {
      body.approvedByName = cert.approvedByName || null;
      body.approvedAt = toT(cert.approvedAt) || (cert.approvedByName ? new Date().toISOString() : null);
    }
    if (Object.keys(body).length === 0) {
      toast.error('You do not have permission to edit these certification fields.');
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/institutional/clearances/${id}/certification`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(
          userErrorFromApi(j, 'Could not save certification.')
        );
      }
      toast.success('Certification saved');
      await load();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not complete that action. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const saveFinalSection = async () => {
    if (!id || !canSignOff) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/institutional/clearances/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalClearanceStatus:
            finalStatus === 'cleared' || finalStatus === 'not_cleared' ? finalStatus : null,
          finalClearanceRemarks: finalRemarks.trim() || null,
        }),
      });
      const j = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(
          userErrorFromApi(j, 'Could not save final clearance.')
        );
      }
      toast.success('Final clearance updated');
      await load();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not complete that action. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const uploadSupportFile = async (fileList: FileList | null) => {
    if (!id || !fileList?.length) return;
    setFileBusy(true);
    try {
      for (const file of fileList) {
        const form = new FormData();
        form.append('file', file);
        form.append('folder', 'institutional-clearance');
        const up = await fetch('/api/blob/upload', {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
        const upJson = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(userErrorFromApi(upJson, 'Could not upload the file. Try again or use a smaller file.'));
        const res = await fetch(`/api/institutional/clearances/${id}/files`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: String((upJson as { file_name?: string }).file_name ?? file.name),
            content_type: (upJson as { content_type?: string | null }).content_type ?? file.type,
            blob_url: String((upJson as { blob_url?: string }).blob_url),
          }),
        });
        const j = await parseResponseJson(res);
        if (!res.ok) {
          throw new Error(
            userErrorFromApi(j, 'Could not attach that file.')
          );
        }
      }
      toast.success('File(s) uploaded');
      await load();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not upload the file. Try again or use a smaller file.'));
    } finally {
      setFileBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const archiveFile = (fileId: string) => {
    if (!id) return;
    setArchiveFileId(fileId);
  };

  const confirmArchiveFile = async () => {
    if (!id || !archiveFileId) return;
    const fileId = archiveFileId;
    setArchiveFileId(null);
    setFileBusy(true);
    try {
      const res = await fetch(`/api/institutional/clearances/${id}/files/${fileId}/archive`, {
        method: 'POST',
        credentials: 'include',
      });
      const j = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(userErrorFromApi(j, 'Could not archive that file.'));
      }
      toast.success('File archived');
      await load();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not archive that file.'));
    } finally {
      setFileBusy(false);
    }
  };

  const fileBeingArchived = (c?.files ?? []).find((f) => f.id === archiveFileId);

  const markRecordDone = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/institutional/clearances/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      const j = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(
          userErrorFromApi(j, 'Could not mark this record complete.')
        );
      }
      toast.success('Record marked complete');
      await load();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not complete that action. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const progress = useMemo(() => {
    const items = c?.items ?? [];
    const total = items.length;
    const signed = items.filter((i) => i.status === 'approved' || i.status === 'waived').length;
    const pending = items.filter((i) => i.status === 'pending').length;
    const rejected = items.filter((i) => i.status === 'rejected').length;
    const percent = total > 0 ? Math.round((signed / total) * 100) : 0;
    return { total, signed, pending, rejected, percent };
  }, [c?.items]);

  const section2Counts = useMemo(() => {
    const items = c?.items ?? [];
    return {
      all: items.length,
      pending: items.filter((i) => i.status === 'pending').length,
      approved: items.filter((i) => i.status === 'approved').length,
      waived: items.filter((i) => i.status === 'waived').length,
      rejected: items.filter((i) => i.status === 'rejected').length,
    };
  }, [c?.items]);

  const section2Rows = useMemo(() => {
    const items = c?.items ?? [];
    const q = section2Query.trim().toLowerCase();
    return items.filter((i) => {
      const matchesFilter = section2Filter === 'all' ? true : i.status === section2Filter;
      const matchesQuery =
        !q ||
        i.departmentLabel.toLowerCase().includes(q) ||
        (i.signatory?.name ?? '').toLowerCase().includes(q) ||
        (i.signatory?.department ?? '').toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [c?.items, section2Filter, section2Query]);

  if (loading || !c) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen w-full min-w-0 space-y-6 bg-gradient-to-br from-slate-50/80 via-blue-50/20 to-transparent px-4 py-6 dark:from-gray-950/50 dark:via-gray-900/30 sm:px-6 lg:px-8">
        <div className="w-full min-w-0 space-y-6">
          <div className="space-y-4 border-b border-border/60 pb-4">
            <Button
              type="button"
              variant="ghost"
              className="gap-1 -ml-2"
              onClick={() => navigate(listPath)}
            >
              <ArrowLeft className="h-4 w-4" />
              List
            </Button>
            <InstitutionalPageBrand
              title={isSignatoryViewPath ? 'Institutional clearance record' : 'Institutional (employee) clearance'}
              subtitle={`${c.fullName} — Section II: fixed office sign-off in order. Sections III–IV: certification and final clearance.`}
            />
            <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/80 p-3 sm:flex-row sm:items-center sm:justify-between">
              <Badge variant="secondary" className="w-fit text-xs uppercase tracking-wide">
                {c.status.replace(/_/g, ' ')}
              </Badge>
              <div className="flex flex-wrap gap-2">
                {c.status === 'draft' && isRequester && (
                  <Button asChild size="sm" variant="outline" className="border-[#1a3c5e]/25 bg-background/80">
                    <Link to={`/dashboard/institutional/clearances/${c.id}/edit`}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Link>
                  </Button>
                )}
                <Button
                  asChild
                  size="sm"
                  className="bg-[#1a3c5e] text-white shadow-sm transition-colors hover:bg-[#15304d] dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  <a href={printPath} target="_blank" rel="noreferrer">
                    <Printer className="h-4 w-4 mr-1" />
                    Print / PDF
                  </a>
                </Button>
                {(isSuperAdmin() || isSignatory()) && c.status === 'in_progress' && (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                    onClick={markRecordDone}
                    disabled={saving}
                  >
                    <Shield className="h-4 w-4 mr-1" />
                    Mark record complete
                  </Button>
                )}
              </div>
            </div>
            {isEmployeeRecordView && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Card className="border-border/70">
                    <CardHeader className="p-3">
                      <CardDescription>Progress</CardDescription>
                      <CardTitle className="text-xl">{progress.percent}%</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="border-border/70">
                    <CardHeader className="p-3">
                      <CardDescription>Signed offices</CardDescription>
                      <CardTitle className="text-xl text-emerald-600 dark:text-emerald-400">
                        {progress.signed}/{progress.total}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="border-border/70">
                    <CardHeader className="p-3">
                      <CardDescription>Pending offices</CardDescription>
                      <CardTitle className="text-xl text-amber-600 dark:text-amber-400">{progress.pending}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="border-border/70">
                    <CardHeader className="p-3">
                      <CardDescription>Rejected offices</CardDescription>
                      <CardTitle className="text-xl text-rose-600 dark:text-rose-400">{progress.rejected}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">Office progress tracker</p>
                    <p className="text-xs text-muted-foreground">{progress.signed}/{progress.total} completed</p>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full border border-border/60 bg-muted">
                    <div className="flex h-full w-full">
                      {progress.total > 0 && (
                        <>
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${(progress.signed / progress.total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${(progress.pending / progress.total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-rose-500"
                            style={{ width: `${(progress.rejected / progress.total) * 100}%` }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      Signed ({progress.signed})
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      Pending ({progress.pending})
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      Rejected ({progress.rejected})
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-semibold">Section I: Personal information</h2>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="break-words font-medium">{c.fullName}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Position</dt>
                <dd className="break-words">{c.position}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="break-words">{labelEmployeeType(c.employeeType)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Department / office</dt>
                <dd className="break-words">{c.department}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Date of separation</dt>
                <dd>
                  {c.dateOfSeparation ? format(new Date(c.dateOfSeparation), 'PPP') : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reason for clearance</dt>
                <dd>{labelReasonCategory(c.reasonCategory)}</dd>
              </div>
              {c.reasonCategory === 'other' && c.reasonOtherDetails && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Others (details)</dt>
                  <dd className="whitespace-pre-wrap">{c.reasonOtherDetails}</dd>
                </div>
              )}
              {c.reason && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Additional remarks</dt>
                  <dd className="whitespace-pre-wrap">{c.reason}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <div className="space-y-3 border-b border-border bg-muted/20 p-4 sm:p-6">
              <h2 className="text-lg font-semibold">Section II: Clearance requirements (by office)</h2>
              <p className="text-sm text-muted-foreground">
                Each office or unit confirms the requester has no remaining liability there. Sign-off is done in
                order from top to bottom.
              </p>
              <div className="flex gap-2 rounded-lg border border-sky-200/80 bg-sky-50/80 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Earlier rows must be approved or waived before the next office can act.</span>
              </div>
              <div className="flex flex-col gap-3 pt-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={section2Filter === 'all' ? 'default' : 'outline'}
                    onClick={() => setSection2Filter('all')}
                  >
                    All ({section2Counts.all})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={section2Filter === 'pending' ? 'default' : 'outline'}
                    onClick={() => setSection2Filter('pending')}
                  >
                    Pending ({section2Counts.pending})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={section2Filter === 'approved' ? 'default' : 'outline'}
                    onClick={() => setSection2Filter('approved')}
                  >
                    Approved ({section2Counts.approved})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={section2Filter === 'waived' ? 'default' : 'outline'}
                    onClick={() => setSection2Filter('waived')}
                  >
                    Waived ({section2Counts.waived})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={section2Filter === 'rejected' ? 'default' : 'outline'}
                    onClick={() => setSection2Filter('rejected')}
                  >
                    Rejected ({section2Counts.rejected})
                  </Button>
                </div>
                <div className="relative w-full lg:w-[340px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={section2Query}
                    onChange={(e) => setSection2Query(e.target.value)}
                    placeholder="Search office or assigned signatory"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto [scrollbar-gutter:stable]">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Office / unit</TableHead>
                    {!canSignOff && <TableHead>Assigned officer</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="min-w-[200px]">Signature / date</TableHead>
                    {!canSignOff && <TableHead>History</TableHead>}
                    {canSignOff && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section2Rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canSignOff ? 5 : 4} className="py-6 text-center text-sm text-muted-foreground">
                        No office rows match this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                  section2Rows.map((it) => {
                    const orderLocked =
                      canSignOff &&
                      !isSuper &&
                      it.status === 'pending' &&
                      it.sequentialUnlocked === false;
                    const employeeSubmitLocked =
                      !canSignOff &&
                      isRequester &&
                      (it.sequentialUnlocked === false || !it.signatoryId);
                    const canEmployeeSubmit =
                      isRequester &&
                      !canSignOff &&
                      it.status === 'pending' &&
                      it.sequentialUnlocked !== false &&
                      !!it.signatoryId;
                    const pendingOfficeFuls =
                      it.fulfillments?.filter((f) => f.kind === 'office' && !f.officeVerifiedAt) ?? [];
                    const approveLocked =
                      orderLocked ||
                      (it.hasSubmission && (it.officeVerificationPending || pendingOfficeFuls.length > 0));
                    return (
                    <TableRow key={it.id} className={orderLocked ? 'opacity-80' : undefined}>
                      <TableCell className="max-w-[240px]">
                        <div className="flex items-start gap-2">
                          {orderLocked && (
                            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                          )}
                          <div>
                        <p className="font-medium text-foreground">{it.departmentLabel}</p>
                        {orderLocked && (
                          <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                            Waiting for earlier offices
                          </p>
                        )}
                          </div>
                        </div>
                      </TableCell>
                      {!canSignOff && (
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {it.signatory?.name
                              ? `${it.signatory.name}${it.signatory.department ? ` — ${it.signatory.department}` : ''}`
                              : 'Not assigned'}
                          </span>
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            it.status === 'approved' || it.status === 'waived'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : it.status === 'rejected'
                                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          }
                        >
                          {it.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {it.approvedAt ? format(new Date(it.approvedAt), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell>
                        {canSignOff ? (
                          <Textarea
                            className="min-h-[64px] min-w-[180px] text-sm"
                            disabled={orderLocked}
                            value={rowDraft[it.id]?.remarks ?? ''}
                            onChange={(e) =>
                              setRowDraft((p) => ({
                                ...p,
                                [it.id]: {
                                  ...p[it.id],
                                  remarks: e.target.value,
                                  approver: p[it.id]?.approver ?? '',
                                },
                              }))
                            }
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {it.status === 'pending' && it.hasSubmission
                              ? it.submissionRemarks || '—'
                              : it.remarks || '—'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {canSignOff ? (
                          <div className="space-y-1.5 min-w-0 max-w-xs">
                            <Input
                              className="h-9 text-sm"
                              disabled={orderLocked}
                              value={rowDraft[it.id]?.approver ?? ''}
                              onChange={(e) =>
                                setRowDraft((p) => ({
                                  ...p,
                                  [it.id]: { remarks: p[it.id]?.remarks ?? '', approver: e.target.value },
                                }))
                              }
                              placeholder="Name & title"
                            />
                            <p className="text-xs text-muted-foreground">
                              Date is recorded automatically when you approve or waive.
                            </p>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {it.approverName ? <span className="font-medium text-foreground">{it.approverName}</span> : '—'}
                            {it.approvedAt ? (
                              <span className="block mt-0.5 text-xs">
                                {format(new Date(it.approvedAt), 'MMM d, yyyy p')}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      {!canSignOff && (
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {canEmployeeSubmit ? (
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 bg-[#1a3c5e] text-white hover:bg-[#15304d] dark:bg-blue-600 dark:hover:bg-blue-700"
                                disabled={employeeSubmitLocked || saving}
                                onClick={() => setSubmitItem(it)}
                              >
                                Submit
                              </Button>
                            ) : (
                              <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-muted-foreground">
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {canSignOff && (
                        <TableCell className="text-right space-y-2">
                          {it.status === 'pending' && pendingOfficeFuls.length > 0 ? (
                            <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2 text-left space-y-1">
                              <p className="text-xs font-medium">Office verification</p>
                              {pendingOfficeFuls.map((f) => (
                                <div key={f.id} className="flex flex-wrap items-center justify-between gap-1">
                                  <span className="text-xs text-muted-foreground">{f.label}</span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 text-xs"
                                    disabled={orderLocked || saving}
                                    onClick={() => openVerifyOffice(it.id, f.id, f.label)}
                                  >
                                    Mark verified
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-[#1a3c5e] text-white shadow-sm hover:bg-[#15304d] dark:bg-blue-600 dark:hover:bg-blue-700"
                              disabled={saving || approveLocked}
                              onClick={() => signOffRow(it.id, 'approved')}
                            >
                              <Check className="h-3.5 w-3.5 mr-0.5" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="border border-border bg-background/80"
                              disabled={saving || approveLocked}
                              onClick={() => signOffRow(it.id, 'waived')}
                            >
                              Waive
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="shadow-sm"
                              disabled={saving || orderLocked}
                              onClick={() => signOffRow(it.id, 'rejected')}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                    );
                  }))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Section III: Certification</h2>
            <p className="text-sm text-muted-foreground">
              Certification that the person has no further accountabilities or obligations in the areas covered, per
              school policy. HRMDO and President fields are limited to the assigned signatory roles (set under
              Signatories). Prepared by: assigned preparer role.
            </p>
            {canEditAnyCert && perms ? (
              <>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <Label>Prepared by</Label>
                    <Input
                      disabled={!perms.canEditPrepared}
                      value={cert.preparedByName}
                      onChange={(e) => setCert((o) => ({ ...o, preparedByName: e.target.value }))}
                    />
                    <Input
                      type="datetime-local"
                      disabled={!perms.canEditPrepared}
                      value={cert.preparedAt}
                      onChange={(e) => setCert((o) => ({ ...o, preparedAt: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Checked and verified by (HRMDO)</Label>
                    <Input
                      disabled={!perms.canEditVerified}
                      value={cert.verifiedByName}
                      onChange={(e) => setCert((o) => ({ ...o, verifiedByName: e.target.value }))}
                    />
                    <Input
                      type="datetime-local"
                      disabled={!perms.canEditVerified}
                      value={cert.verifiedAt}
                      onChange={(e) => setCert((o) => ({ ...o, verifiedAt: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Approved by (College President)</Label>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Input
                        placeholder="Name"
                        disabled={!perms.canEditApproved}
                        value={cert.approvedByName}
                        onChange={(e) => setCert((o) => ({ ...o, approvedByName: e.target.value }))}
                      />
                      <Input
                        type="datetime-local"
                        disabled={!perms.canEditApproved}
                        value={cert.approvedAt}
                        onChange={(e) => setCert((o) => ({ ...o, approvedAt: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={saveCert}
                  disabled={saving}
                  className="bg-[#1a3c5e] text-white shadow-sm hover:bg-[#15304d] dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save certification'}
                </Button>
              </>
            ) : (
              <dl className="grid sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div>
                  <dt>Prepared by</dt>
                  <dd className="text-foreground">{c.certification?.preparedByName || '—'}</dd>
                </div>
                <div>
                  <dt>HRMDO (verified)</dt>
                  <dd className="text-foreground">{c.certification?.verifiedByName || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt>College President (approved)</dt>
                  <dd className="text-foreground">{c.certification?.approvedByName || '—'}</dd>
                </div>
              </dl>
            )}
          </div>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Section IV: Final clearance</CardTitle>
              <CardDescription>Overall result after review of Sections II and III.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canSignOff ? (
                <>
                  <div className="space-y-2 max-w-sm">
                    <Label>Outcome</Label>
                    <Select value={finalStatus || 'none'} onValueChange={(v) => setFinalStatus(v === 'none' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="cleared">Cleared</SelectItem>
                        <SelectItem value="not_cleared">Not cleared</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ic-final-remarks">Remarks</Label>
                    <Textarea
                      id="ic-final-remarks"
                      className="min-h-[100px]"
                      value={finalRemarks}
                      onChange={(e) => setFinalRemarks(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={saveFinalSection}
                    disabled={saving}
                    className="bg-[#1a3c5e] text-white shadow-sm hover:bg-[#15304d] dark:bg-blue-600 dark:hover:bg-blue-700"
                  >
                    Save final clearance
                  </Button>
                </>
              ) : (
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">Outcome: </span>
                    <span className="font-medium text-foreground">
                      {c.finalClearanceStatus === 'cleared'
                        ? 'Cleared'
                        : c.finalClearanceStatus === 'not_cleared'
                          ? 'Not cleared'
                          : '—'}
                    </span>
                  </p>
                  {c.finalClearanceRemarks && (
                    <p className="whitespace-pre-wrap text-muted-foreground">{c.finalClearanceRemarks}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="supporting-documents" className="scroll-mt-20 border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Supporting documents</CardTitle>
              <CardDescription>
                Attach required letters, property return forms, or other files. Visible to authorized users on this
                record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(e) => void uploadSupportFile(e.target.files)}
                />
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#1a3c5e] text-white shadow-sm hover:bg-[#15304d] dark:bg-blue-600 dark:hover:bg-blue-700"
                  disabled={fileBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {fileBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  Add files
                </Button>
              </div>
              {(c.files ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No files attached yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {(c.files ?? []).map((f) => (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 px-3 py-2"
                    >
                      <a
                        href={f.blob_url}
                        className="text-primary font-medium hover:underline break-all"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {f.file_name}
                      </a>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={fileBusy}
                        onClick={() => void archiveFile(f.id)}
                        title="Archive file"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <h3 className="font-semibold">Instructions (bottom of form)</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Must be completed before release of final pay, credentials, and similar exit benefits.</li>
              <li>All obligations to the school must be settled.</li>
              <li>Attach supporting documents as required (endorsement, clearance from lending, property return, etc.).</li>
            </ul>
          </div>
        </div>
      </div>

      {submitItem ? (
        <OfficeRequestModal
          officeName={submitItem.departmentLabel}
          requirements={requirementToOfficeUi(submitItem.requirements ?? [])}
          legacySubmit={(submitItem.requirements?.length ?? 0) === 0}
          onClose={() => setSubmitItem(null)}
          onSubmit={submitInstitutionalOffice}
        />
      ) : null}

      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify office requirement</DialogTitle>
            <DialogDescription>
              Confirm in-office checks for: {verifyTarget?.label ?? 'this requirement'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Verification notes (required)</Label>
            <Textarea
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.target.value)}
              placeholder="Describe what was checked in office..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)} disabled={verifyLoading}>
              Cancel
            </Button>
            <Button onClick={() => void submitOfficeVerification()} disabled={verifyLoading || !verifyNotes.trim()}>
              {verifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm verified'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveFileId} onOpenChange={(open) => { if (!open) setArchiveFileId(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this file?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{fileBeingArchived?.file_name ?? 'This file'}</strong> will be hidden from this clearance record.
              It is not permanently deleted and can be reviewed by administrators.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmArchiveFile()}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
