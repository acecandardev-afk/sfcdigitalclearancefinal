import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Clock, CheckCircle, XCircle, FileText, Loader2, Paperclip, Filter, Search, ArrowUpDown, Lock, Eye, Users, List, Activity, BarChart3, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { safeActionErrorMessage } from '@/lib/userFacingError';
import { friendlyApiErrorMessage, userErrorFromApi } from '@/lib/userMessages';
import ClearanceFilesViewer from './ClearanceFilesViewer';
import { TERMS } from '@/lib/terms';
import { logActivity } from '@/hooks/useActivityLog';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, subDays } from 'date-fns';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

function isAwaitingSignatureStatus(status: string) {
  return status === 'pending' || status === 'in_progress';
}

interface PendingSignature {
  id: string;
  signatory_id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  notes: string | null;
  remarks: string | null;
  sequence_order: number;
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
  canSign?: boolean; // computed field
}

interface AllSignature {
  id: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  sequence_order: number;
  clearance_request_id: string;
  signatory_group?: 'standard' | 'authority';
  authority_sequence_order?: number | null;
}

type ProfileRow = {
  id: string;
  full_name: string;
  student_id: string | null;
  course: string | null;
  year_level: string | null;
};

/** Row shape from clearance_signatures + nested clearance_request */
type RawPendingRow = {
  id: string;
  status: PendingSignature['status'];
  notes: string | null;
  remarks: string | null;
  sequence_order: number;
  created_at: string;
  signatory_group?: 'standard' | 'authority';
  authority_sequence_order?: number | null;
  clearance_request: {
    id: string;
    title: string;
    description: string | null;
    created_at: string;
    student_id: string;
  } | null;
};

export default function SignatoryDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [signatures, setSignatures] = useState<PendingSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignature, setSelectedSignature] = useState<PendingSignature | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [filesViewerOpen, setFilesViewerOpen] = useState(false);
  const [viewingSignature, setViewingSignature] = useState<PendingSignature | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'action' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'approve' | 'reject'>('approve');
  const [bulkRemarks, setBulkRemarks] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [signatoryId, setSignatoryId] = useState<string | null>(null);
  const [signatoryInfo, setSignatoryInfo] = useState<{ name: string; position: string; department: string } | null>(null);
  /** API returned NO_SIGNATORY_ROW — user has signatory role but no linked office row (wrong account or data). */
  const [noLinkedOffice, setNoLinkedOffice] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    if (user) {
      fetchPendingSignatures();
    }
  }, [user]);

  const fetchPendingSignatures = async () => {
    try {
      setNoLinkedOffice(false);
      const res = await fetch('/api/signatory/pending', { credentials: 'include' });
      const json = (await res.json().catch(() => ({}))) as {
        code?: string;
        signatory?: { id: string; name: string; position: string; department: string };
        signatures?: PendingSignature[];
      };

      if (res.status === 404 && json?.code === 'NO_SIGNATORY_ROW') {
        setSignatoryId(null);
        setSignatoryInfo(null);
        setSignatures([]);
        setNoLinkedOffice(true);
        return;
      }

      if (!res.ok) throw new Error(await friendlyApiErrorMessage(res, 'Could not load pending signatures.'));

      const sig = json.signatory;
      setSignatoryId(sig?.id ?? null);
      setSignatoryInfo(
        sig ? { name: sig.name || 'Signatory', position: sig.position || '', department: sig.department || '' } : null
      );
      setSignatures((json.signatures || []) as PendingSignature[]);
    } catch (error) {
      console.error('Error fetching signatures:', error);
      toast.error(safeActionErrorMessage(error, 'Could not load pending signatures.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (signature: PendingSignature, type: 'approve' | 'reject') => {
    setSelectedSignature(signature);
    setActionType(type);
    setRemarks('');
    setDialogOpen(true);
  };

  const handleViewFiles = (signature: PendingSignature) => {
    setViewingSignature(signature);
    setFilesViewerOpen(true);
  };

  const submitAction = async () => {
    if (!selectedSignature) return;
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
          signature_id: selectedSignature.id,
          action: actionType,
          remarks: remarks.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(userErrorFromApi(json, 'Could not save your decision. Please try again.'));

      toast.success(`Request ${actionType === 'approve' ? 'signed' : 'rejected'} successfully`);
      setDialogOpen(false);
      fetchPendingSignatures();
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
      case 'in_progress':
        return <Badge variant="pending">{status === 'in_progress' ? 'In progress' : TERMS.PENDING}</Badge>;
      case 'approved':
        return <Badge variant="approved">{TERMS.APPROVED}</Badge>;
      case 'rejected':
        return <Badge variant="rejected">{TERMS.REJECTED}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  /** All rows still awaiting action (includes blocked by authority sequence). */
  const allPendingCount = signatures.filter((s) => isAwaitingSignatureStatus(s.status)).length;
  /** You can sign these now (standard or your turn in authority chain). */
  const needsActionCount = signatures.filter((s) => isAwaitingSignatureStatus(s.status) && s.canSign).length;
  /** Waiting on other signatories before you can act. */
  const blockedPendingCount = signatures.filter((s) => isAwaitingSignatureStatus(s.status) && !s.canSign).length;
  const approvedCount = signatures.filter((s) => s.status === 'approved').length;
  const rejectedCount = signatures.filter((s) => s.status === 'rejected').length;

  // Unique clearance requests
  const uniqueRequestIds = new Set(signatures.map((s) => s.clearance_request?.id).filter(Boolean));
  const totalRequests = uniqueRequestIds.size;

  // Unique students
  const uniqueStudentIds = new Set(signatures.map((s) => (s.clearance_request as any)?.student_id).filter(Boolean));
  const studentsAwaiting = new Set(
    signatures
      .filter((s) => isAwaitingSignatureStatus(s.status) && s.canSign)
      .map((s) => (s.clearance_request as any)?.student_id)
      .filter(Boolean)
  ).size;
  const studentsApproved = new Set(
    signatures
      .filter((s) => s.status === 'approved')
      .map((s) => (s.clearance_request as any)?.student_id)
      .filter(Boolean)
  ).size;
  const studentsRejected = new Set(
    signatures
      .filter((s) => s.status === 'rejected')
      .map((s) => (s.clearance_request as any)?.student_id)
      .filter(Boolean)
  ).size;

  // Progress chart: your completed vs still outstanding (actionable + blocked pending)
  const totalForChart = approvedCount + allPendingCount;
  const progressChartData = totalForChart > 0
    ? [
        { name: 'Signed by you', value: approvedCount, fill: '#10b981' },
        { name: 'Needs your signature', value: needsActionCount, fill: '#ca8a04' },
        { name: 'Waiting on others', value: blockedPendingCount, fill: '#fde047' },
      ].filter((d) => d.value > 0)
    : [];
  const approvedPct = totalForChart > 0 ? Math.round((approvedCount / totalForChart) * 100) : 0;

  // Bar chart data for status breakdown
  const statusBarData = [
    { name: 'Needs signature', count: needsActionCount, fill: '#ca8a04' },
    { name: 'Waiting on others', count: blockedPendingCount, fill: '#fde047' },
    { name: 'Approved', count: approvedCount, fill: '#10b981' },
    { name: 'Rejected', count: rejectedCount, fill: '#ef4444' },
  ].filter((d) => d.count > 0);

  // Requests over time (last 7 days)
  const requestsOverTimeData = (() => {
    const days = 7;
    const result: { date: string; pending: number; approved: number; rejected: number; total: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'MMM d');
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const daySigs = signatures.filter((s) => {
        const created = new Date(s.created_at);
        return created >= dayStart && created <= dayEnd;
      });
      result.push({
        date: dateStr,
        pending: daySigs.filter((s) => isAwaitingSignatureStatus(s.status) && s.canSign).length,
        approved: daySigs.filter((s) => s.status === 'approved').length,
        rejected: daySigs.filter((s) => s.status === 'rejected').length,
        total: daySigs.length,
      });
    }
    return result;
  })();

  const filteredSignatures = signatures.filter((s) => {
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'action'
          ? isAwaitingSignatureStatus(s.status) && s.canSign
          : statusFilter === 'pending'
            ? isAwaitingSignatureStatus(s.status)
            : s.status === statusFilter;
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || 
      s.clearance_request.title.toLowerCase().includes(query) ||
      s.clearance_request.profiles.full_name.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  // Sort filtered signatures
  const sortedSignatures = [...filteredSignatures].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case 'name':
        comparison = a.clearance_request.profiles.full_name.localeCompare(b.clearance_request.profiles.full_name);
        break;
      case 'title':
        comparison = a.clearance_request.title.localeCompare(b.clearance_request.title);
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedSignatures.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSignatures = sortedSignatures.slice(startIndex, endIndex);

  // Bulk action helpers (must be after paginatedSignatures is defined)
  // Only allow bulk actions on signatures that can sign (previous are approved)
  const signableSignaturesOnPage = paginatedSignatures.filter(
    (s) => isAwaitingSignatureStatus(s.status) && s.canSign
  );
  const allSignableSelected = signableSignaturesOnPage.length > 0 && 
    signableSignaturesOnPage.every(s => selectedIds.has(s.id));
  const someSignableSelected = signableSignaturesOnPage.some(s => selectedIds.has(s.id));

  const toggleSelectAll = () => {
    if (allSignableSelected) {
      const newSelected = new Set(selectedIds);
      signableSignaturesOnPage.forEach(s => newSelected.delete(s.id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      signableSignaturesOnPage.forEach(s => newSelected.add(s.id));
      setSelectedIds(newSelected);
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkAction = (type: 'approve' | 'reject') => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one request');
      return;
    }
    setBulkActionType(type);
    setBulkRemarks('');
    setBulkDialogOpen(true);
  };

  const submitBulkAction = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkRemarks.trim()) {
      toast.error('Remarks are required');
      return;
    }

    setBulkActionLoading(true);
    try {
      for (const id of Array.from(selectedIds)) {
        const res = await fetch('/api/clearance/sign', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signature_id: id,
            action: bulkActionType,
            remarks: bulkRemarks.trim(),
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(userErrorFromApi(json, 'Could not update one or more signatures.'));
      }

      const sid = signatoryId;
      if (sid) {
        for (const sig of signatures) {
          if (!selectedIds.has(sig.id)) continue;
          const crId = sig.clearance_request?.id;
          if (!crId) continue;
          void logActivity({
            action: bulkActionType === 'approve' ? 'sign_clearance' : 'reject_clearance',
            details: {
              clearance_request_id: crId,
              signatory_id: sid,
              signature_id: sig.id,
              bulk: true,
            },
          });
        }
      }

      toast.success(`${selectedIds.size} request(s) ${bulkActionType === 'approve' ? 'signed' : 'rejected'} successfully`);
      setBulkDialogOpen(false);
      setSelectedIds(new Set());
      fetchPendingSignatures();
    } catch (error) {
      console.error('Error updating signatures:', error);
      toast.error(safeActionErrorMessage(error, 'Could not update one or more signatures.'));
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, sortBy, sortOrder]);

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, 'ellipsis', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="w-full min-w-0 p-6 lg:p-8 xl:px-10 space-y-8 bg-background/75 min-h-screen">
      {/* Header with Live indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-semibold text-foreground tracking-tight">
              {location.pathname.includes('/requests') ? 'To sign' : 'Signatory dashboard'}
            </h1>
            {signatoryInfo && (signatoryInfo.position || signatoryInfo.department) && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium bg-primary/10 text-primary border border-primary/20">
                {[signatoryInfo.position, signatoryInfo.department].filter(Boolean).join(' • ')}
              </span>
            )}
            {signatoryId && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <Activity className="h-3 w-3 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {signatoryInfo ? `${signatoryInfo.name} — Review and sign student requests` : 'Review and sign student requests'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-sm ${
              studentsAwaiting === 0
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-amber-500/30 bg-amber-500/5'
            }`}
          >
            <Clock
              className={`h-5 w-5 shrink-0 ${studentsAwaiting === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}
            />
            {studentsAwaiting === 0 ? (
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">All caught up — no signature needed</span>
            ) : (
              <>
                <span className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">{studentsAwaiting}</span>
                <span className="text-sm text-muted-foreground">
                  student{studentsAwaiting !== 1 ? 's' : ''} {studentsAwaiting === 1 ? 'needs' : 'need'} your signature
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground">
            <List className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-semibold text-foreground tabular-nums">{totalRequests}</span> assigned clearance{totalRequests !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {noLinkedOffice && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-lg">No student-clearance office linked to this login</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Your account has the signatory role, but it is not attached to a student-clearance office record (or
              your email does not match any row). Use a seeded student-line account (for example{' '}
              <code className="rounded bg-muted px-1 text-foreground">signatory1@gmail.com</code> through{' '}
              <code className="rounded bg-muted px-1 text-foreground">signatory15@gmail.com</code>) that matches the
              registrar list, or ask an administrator to open <strong>Signatories</strong> and link your user to the
              correct office.
              <span className="mt-3 block text-sm text-muted-foreground">
                Exit-clearance-only accounts (<code className="rounded bg-muted px-1 text-foreground">institutional…@gmail.com</code>) do
                not receive student clearance requests on this page.
              </span>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Stats - Modern cards with hover effects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/50 rounded-xl shadow-sm bg-card/80 backdrop-blur-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold mt-1 tabular-nums group-hover:text-primary transition-colors">{totalRequests}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <List className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-xl shadow-sm bg-card/80 backdrop-blur-sm hover:shadow-lg hover:border-amber-500/30 transition-all duration-300 group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Needs your signature</p>
                <p className="text-2xl font-bold mt-1 tabular-nums text-amber-600 dark:text-amber-400">{needsActionCount}</p>
                {blockedPendingCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{blockedPendingCount} waiting on other signatories</p>
                )}
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-xl shadow-sm bg-card/80 backdrop-blur-sm hover:shadow-lg hover:border-emerald-500/30 transition-all duration-300 group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Signed by you</p>
                <p className="text-2xl font-bold mt-1 tabular-nums text-emerald-600 dark:text-emerald-400">{approvedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-xl shadow-sm bg-card/80 backdrop-blur-sm hover:shadow-lg hover:border-destructive/30 transition-all duration-300 group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{TERMS.REJECTED}</p>
                <p className="text-2xl font-bold mt-1 tabular-nums text-destructive">{rejectedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive">
                <XCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests list — primary work queue */}
      <Card className="border border-border/50 rounded-xl shadow-sm bg-card">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Clearance requests</CardTitle>
              <CardDescription className="text-sm">
                Default shows requests you can act on now. Use the filter to see all statuses.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="action">Needs my signature ({needsActionCount})</SelectItem>
                  <SelectItem value="all">All ({signatures.length})</SelectItem>
                  <SelectItem value="pending">All pending ({allPendingCount})</SelectItem>
                  <SelectItem value="approved">Signed by you ({approvedCount})</SelectItem>
                  <SelectItem value="rejected">{TERMS.REJECTED} ({rejectedCount})</SelectItem>
                </SelectContent>
              </Select>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground ml-2" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="name">Student Name</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as typeof sortOrder)}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest</SelectItem>
                  <SelectItem value="asc">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student name or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredSignatures.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                {signatures.length === 0
                  ? 'No requests assigned'
                  : statusFilter === 'action' && needsActionCount === 0
                    ? "You're all caught up"
                    : 'No matching requests'}
              </h3>
              <p className="text-muted-foreground mt-2">
                {signatures.length === 0
                  ? "You don't have any clearance requests assigned to you yet."
                  : statusFilter === 'action' && needsActionCount === 0
                    ? 'Nothing needs your signature right now. Pending items may be waiting on other signatories, or try “All pending” in the filter.'
                    : statusFilter === 'action'
                      ? 'Try adjusting search or filter.'
                      : 'Try a different filter or search.'}
              </p>
            </div>
          ) : (
            <>
              {/* Bulk Actions Bar */}
              {signableSignaturesOnPage.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={allSignableSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                      Select all signable ({signableSignaturesOnPage.length})
                    </label>
                  </div>
                  {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-sm text-muted-foreground">
                        {selectedIds.size} selected
                      </span>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleBulkAction('approve')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Sign Selected
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleBulkAction('reject')}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject Selected
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-4">
                {paginatedSignatures.map((signature, index) => (
                  <div
                    key={signature.id}
                    className={`flex flex-col lg:flex-row lg:items-center justify-between p-4 rounded-xl border border-border/60 hover:bg-muted/40 hover:border-primary/20 hover:shadow-sm transition-all duration-300 gap-4 ${
                      isAwaitingSignatureStatus(signature.status) && !signature.canSign ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {isAwaitingSignatureStatus(signature.status) && signature.canSign && (
                        <Checkbox
                          checked={selectedIds.has(signature.id)}
                          onCheckedChange={() => toggleSelectOne(signature.id)}
                          className="mt-1"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs font-bold">
                          {signature.sequence_order}
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
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
                        <p className="text-xs text-muted-foreground">
                          ID: {signature.clearance_request.profiles.student_id || 'N/A'}
                        </p>
                        {isAwaitingSignatureStatus(signature.status) && !signature.canSign && (
                          <p className="text-xs text-warning mt-1 flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Pending approval from previous signatories
                          </p>
                        )}
                        {signature.remarks && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Remarks: "{signature.remarks}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:gap-3 ml-12 lg:ml-0">
                      {getStatusBadge(signature.status)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/dashboard/requests/${signature.clearance_request.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewFiles(signature)}
                      >
                        <Paperclip className="h-4 w-4 mr-1" />
                        Files
                      </Button>
                      {isAwaitingSignatureStatus(signature.status) && signature.canSign && (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleAction(signature, 'approve')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Sign
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, sortedSignatures.length)} of {sortedSignatures.length} requests
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {getPageNumbers().map((page, idx) => (
                        <PaginationItem key={idx}>
                          {page === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {/* Interactive Charts - Real-time analytics (always visible) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Status breakdown - Bar chart */}
        <Card className="border border-border/50 rounded-xl shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Status Breakdown</CardTitle>
            </div>
            <CardDescription>Needs action vs waiting on others vs completed</CardDescription>
          </CardHeader>
          <CardContent>
            {statusBarData.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusBarData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} fontSize={12} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                      cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                      formatter={(value: number) => [value, 'Count']}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Requests">
                      {statusBarData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <BarChart3 className="h-12 w-12 opacity-30" />
                <p className="text-sm">No requests yet</p>
                <p className="text-xs">Charts will appear when students submit clearance requests</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requests over time - Area chart */}
        <Card className="border border-border/50 rounded-xl shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Activity (Last 7 Days)</CardTitle>
            </div>
            <CardDescription>Signatures you can act on (per day)</CardDescription>
          </CardHeader>
          <CardContent>
            {requestsOverTimeData.some((d) => d.total > 0) ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={requestsOverTimeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorRejected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="pending" stackId="1" stroke="#eab308" fill="url(#colorPending)" name="Needs your signature" />
                    <Area type="monotone" dataKey="approved" stackId="1" stroke="#10b981" fill="url(#colorApproved)" name="Approved" />
                    <Area type="monotone" dataKey="rejected" stackId="1" stroke="#ef4444" fill="url(#colorRejected)" name="Rejected" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <TrendingUp className="h-12 w-12 opacity-30" />
                <p className="text-sm">No activity yet</p>
                <p className="text-xs">Activity will appear when requests are assigned to you</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Donut + Student counts - Compact overview (always visible) */}
      <Card className="border border-border/50 rounded-xl shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Overview</CardTitle>
          <CardDescription>Completion rate and student breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {signatures.length > 0 ? (
            <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
              <div className="h-[160px] w-full max-w-[160px] shrink-0 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={progressChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius="50%"
                      outerRadius="85%"
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      animationDuration={800}
                      animationBegin={0}
                    >
                      {progressChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold text-foreground">{approvedPct}%</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors">
                  <Users className="h-8 w-8 text-muted-foreground/60" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Students</p>
                    <p className="text-lg font-bold tabular-nums">{uniqueStudentIds.size}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                  <Clock className="h-8 w-8 text-amber-500/70" />
                  <div>
                    <p className="text-xs text-muted-foreground">Need your signature</p>
                    <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{studentsAwaiting}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
                  <CheckCircle className="h-8 w-8 text-emerald-500/70" />
                  <div>
                    <p className="text-xs text-muted-foreground">Approved</p>
                    <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{studentsApproved}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors">
                  <XCircle className="h-8 w-8 text-destructive/70" />
                  <div>
                    <p className="text-xs text-muted-foreground">Rejected</p>
                    <p className="text-lg font-bold tabular-nums text-destructive">{studentsRejected}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row items-center gap-6 py-8">
              <div className="h-[120px] w-[120px] rounded-full border-2 border-dashed border-muted flex items-center justify-center">
                <Users className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <div className="flex-1 text-center lg:text-left">
                <p className="text-muted-foreground">No requests assigned yet</p>
                <p className="text-sm text-muted-foreground/80 mt-1">Student breakdown will appear when clearance requests are assigned to you</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Sign / Reject Confirmation Dialog */}
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
              <p className="text-xs text-muted-foreground">
                Remarks will be displayed on the student&apos;s request record.
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
              disabled={actionLoading || !remarks.trim()}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : actionType === 'approve' ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {actionType === 'approve' ? 'Confirm Sign' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Sign / Reject Confirmation Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {bulkActionType === 'approve' ? 'Confirm Sign' : 'Reject'} {selectedIds.size} Request(s)
            </DialogTitle>
            <DialogDescription>
              {bulkActionType === 'approve'
                ? `You are about to sign ${selectedIds.size} request(s). Enter required remarks below, then confirm.`
                : `Provide remarks for declining ${selectedIds.size} request(s).`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Remarks (required — applies to all selected)</Label>
              <Textarea
                placeholder={
                  bulkActionType === 'approve'
                    ? 'Enter remarks for the students...'
                    : 'Explain why these requests are being rejected...'
                }
                value={bulkRemarks}
                onChange={(e) => setBulkRemarks(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={bulkActionType === 'approve' ? 'success' : 'destructive'}
              onClick={submitBulkAction}
              disabled={bulkActionLoading || !bulkRemarks.trim()}
            >
              {bulkActionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : bulkActionType === 'approve' ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {bulkActionType === 'approve' ? 'Confirm Sign All' : 'Reject All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Files Viewer Dialog */}
      {viewingSignature && (
        <ClearanceFilesViewer
          clearanceRequestId={viewingSignature.clearance_request.id}
          clearanceTitle={viewingSignature.clearance_request.title}
          studentName={viewingSignature.clearance_request.profiles.full_name}
          open={filesViewerOpen}
          onOpenChange={setFilesViewerOpen}
        />
      )}
    </div>
  );
}
