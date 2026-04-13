import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useUserRole } from '@/hooks/useUserRole';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  FileSpreadsheet,
  BarChart3,
  RefreshCw,
  Download,
  ClipboardList,
  PenLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { getStatusLabel } from '@/lib/terms';
import { safeActionErrorMessage } from '@/lib/userFacingError';

type ClearanceStatus = 'pending' | 'in_progress' | 'approved' | 'rejected';

function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map((c) => csvEscape(c)).join(','));
  }
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface ClearanceRow {
  id: string;
  title: string;
  description: string | null;
  status: ClearanceStatus | null;
  created_at: string | null;
  updated_at: string | null;
  student_id: string;
  profiles: {
    full_name: string;
    email: string | null;
    student_id: string | null;
    course: string | null;
    year_level: string | null;
  } | null;
}

interface SignatureRow {
  id: string;
  clearance_request_id: string;
  status: ClearanceStatus | null;
  signed_at: string | null;
  created_at: string | null;
  sequence_order: number;
  notes: string | null;
  remarks: string | null;
  signatories: {
    name: string;
    position: string;
    department: string;
    email: string;
  } | null;
  clearance: {
    id: string;
    title: string;
    status: ClearanceStatus | null;
    created_at: string | null;
    student_id: string;
  };
  student: {
    full_name: string;
    email: string | null;
    student_id: string | null;
    course: string | null;
    year_level: string | null;
  };
}

export default function Reports() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();

  const [activeTab, setActiveTab] = useState<'clearances' | 'signatures'>('clearances');
  const [allDates, setAllDates] = useState(false);
  const [fromDate, setFromDate] = useState(() => format(new Date(Date.now() - 89 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const [clearanceStatus, setClearanceStatus] = useState<'all' | ClearanceStatus>('all');
  const [signatureStatus, setSignatureStatus] = useState<'all' | ClearanceStatus>('all');
  const [signatureClearanceStatus, setSignatureClearanceStatus] = useState<'all' | ClearanceStatus>('all');

  const [loading, setLoading] = useState(false);
  const [clearanceRows, setClearanceRows] = useState<ClearanceRow[]>([]);
  const [signatureRows, setSignatureRows] = useState<SignatureRow[]>([]);

  useEffect(() => {
    if (!roleLoading && !isSuperAdmin()) {
      navigate('/dashboard');
    }
  }, [roleLoading, isSuperAdmin, navigate]);

  const rangeIso = useMemo(() => {
    if (allDates) return { from: null as string | null, to: null as string | null };
    const start = new Date(fromDate + 'T00:00:00');
    const end = new Date(toDate + 'T23:59:59.999');
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { from: null, to: null };
    }
    if (start > end) {
      return { from: null, to: null, invalid: true as const };
    }
    return { from: start.toISOString(), to: end.toISOString(), invalid: false as const };
  }, [allDates, fromDate, toDate]);

  const generateClearances = async () => {
    if ('invalid' in rangeIso && rangeIso.invalid) {
      toast.error('Invalid date range (from must be before to).');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: 'clearances' });
      if (clearanceStatus !== 'all') params.set('clearanceStatus', clearanceStatus);
      if (allDates) {
        params.set('allDates', '1');
      } else if (rangeIso.from && rangeIso.to) {
        params.set('from', fromDate);
        params.set('to', toDate);
      }
      const res = await fetch(`/api/admin/reports?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      const json = await res.json();
      const rows = (json.clearances ?? []) as ClearanceRow[];
      setClearanceRows(rows);
      toast.success(`Loaded ${rows.length} clearance record(s).`);
    } catch (e) {
      console.error(e);
      toast.error(safeActionErrorMessage(e, 'Failed to load clearance report'));
    } finally {
      setLoading(false);
    }
  };

  const generateSignatures = async () => {
    if ('invalid' in rangeIso && rangeIso.invalid) {
      toast.error('Invalid date range (from must be before to).');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: 'signatures' });
      if (signatureStatus !== 'all') params.set('signatureStatus', signatureStatus);
      if (signatureClearanceStatus !== 'all') {
        params.set('signatureClearanceStatus', signatureClearanceStatus);
      }
      if (allDates) {
        params.set('allDates', '1');
      } else if (rangeIso.from && rangeIso.to) {
        params.set('from', fromDate);
        params.set('to', toDate);
      }

      const res = await fetch(`/api/admin/reports?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      const json = await res.json();
      const merged = (json.signatures ?? []) as SignatureRow[];

      if (merged.length === 0) {
        setSignatureRows([]);
        toast.success('No signature rows match the filters.');
        setLoading(false);
        return;
      }

      setSignatureRows(merged);
      toast.success(`Loaded ${merged.length} signature step(s).`);
    } catch (e) {
      console.error(e);
      toast.error(safeActionErrorMessage(e, 'Failed to load signature report'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    if (activeTab === 'clearances') void generateClearances();
    else void generateSignatures();
  };

  const exportClearancesCsv = () => {
    if (clearanceRows.length === 0) {
      toast.error('Generate a report first.');
      return;
    }
    const headers = [
      'Request ID',
      'Title',
      'Status',
      'Created',
      'Updated',
      'Student name',
      'School ID',
      'Email',
      'Course',
      'Year level',
      'Description',
    ];
    const rows = clearanceRows.map((r) => [
      r.id,
      r.title,
      r.status ?? '',
      r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm') : '',
      r.updated_at ? format(new Date(r.updated_at), 'yyyy-MM-dd HH:mm') : '',
      r.profiles?.full_name ?? '',
      r.profiles?.student_id ?? '',
      r.profiles?.email ?? '',
      r.profiles?.course ?? '',
      r.profiles?.year_level ?? '',
      r.description ?? '',
    ]);
    downloadCsv(
      `clearance-requests-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`,
      headers,
      rows
    );
    toast.success('CSV downloaded.');
  };

  const exportSignaturesCsv = () => {
    if (signatureRows.length === 0) {
      toast.error('Generate a report first.');
      return;
    }
    const headers = [
      'Signature ID',
      'Sequence',
      'Step status',
      'Signed at',
      'Step created',
      'Signatory',
      'Department',
      'Signatory email',
      'Clearance title',
      'Request status',
      'Request created',
      'Student',
      'School ID',
      'Student email',
      'Course',
      'Notes',
      'Remarks',
    ];
    const rows = signatureRows.map((r) => [
      r.id,
      r.sequence_order,
      r.status ?? '',
      r.signed_at ? format(new Date(r.signed_at), 'yyyy-MM-dd HH:mm') : '',
      r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm') : '',
      r.signatories?.name ?? '',
      r.signatories?.department ?? '',
      r.signatories?.email ?? '',
      r.clearance.title,
      r.clearance.status ?? '',
      r.clearance.created_at ? format(new Date(r.clearance.created_at), 'yyyy-MM-dd HH:mm') : '',
      r.student.full_name,
      r.student.student_id ?? '',
      r.student.email ?? '',
      r.student.course ?? '',
      r.notes ?? '',
      r.remarks ?? '',
    ]);
    downloadCsv(
      `clearance-signatures-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`,
      headers,
      rows
    );
    toast.success('CSV downloaded.');
  };

  const clearanceSummary = useMemo(() => {
    const m = { pending: 0, in_progress: 0, approved: 0, rejected: 0 };
    for (const r of clearanceRows) {
      const s = r.status;
      if (s && s in m) m[s]++;
    }
    return m;
  }, [clearanceRows]);

  const signatureSummary = useMemo(() => {
    const m = { pending: 0, in_progress: 0, approved: 0, rejected: 0 };
    for (const r of signatureRows) {
      const s = r.status;
      if (s && s in m) m[s]++;
    }
    return m;
  }, [signatureRows]);

  const previewLimit = 150;
  const clearancePreview = clearanceRows.slice(0, previewLimit);
  const signaturePreview = signatureRows.slice(0, previewLimit);

  const statusBadge = (status: string | null) => {
    const s = status ?? '';
    switch (s) {
      case 'pending':
        return <Badge variant="pending">{getStatusLabel(s)}</Badge>;
      case 'in_progress':
        return <Badge variant="in-progress">{getStatusLabel(s)}</Badge>;
      case 'approved':
        return <Badge variant="approved">{getStatusLabel(s)}</Badge>;
      case 'rejected':
        return <Badge variant="rejected">{getStatusLabel(s)}</Badge>;
      default:
        return <Badge variant="outline">{s || '—'}</Badge>;
    }
  };

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isSuperAdmin()) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-[#1a3c5e]/10 dark:bg-blue-500/15">
                <BarChart3 className="h-6 w-6 text-[#1a3c5e] dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium uppercase tracking-wide text-[#1a3c5e]/80 dark:text-blue-400/90">
                Administrator
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-[#1a3c5e] dark:text-blue-400">
              Reports
            </h1>
            <p className="text-muted-foreground mt-1 text-sm max-w-xl">
              Generate tabular reports and export CSV for clearance requests and per-signatory signature steps.
              Date filters use the record creation time in the database (UTC).
            </p>
          </div>
        </div>

        <Card className="border border-border/50 rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <div className="flex flex-col lg:flex-row lg:items-start gap-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 h-11">
                  <TabsTrigger value="clearances" className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Clearance requests
                  </TabsTrigger>
                  <TabsTrigger value="signatures" className="gap-2">
                    <PenLine className="h-4 w-4" />
                    Signature steps
                  </TabsTrigger>
                </TabsList>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>From</Label>
                    <input
                      type="date"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      disabled={allDates}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>To</Label>
                    <input
                      type="date"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      disabled={allDates}
                    />
                  </div>

                  {activeTab === 'clearances' && (
                    <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                      <Label>Request status</Label>
                      <Select
                        value={clearanceStatus}
                        onValueChange={(v) => setClearanceStatus(v as typeof clearanceStatus)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="approved">Completed</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {activeTab === 'signatures' && (
                    <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Step status</Label>
                          <Select
                            value={signatureStatus}
                            onValueChange={(v) => setSignatureStatus(v as typeof signatureStatus)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In progress</SelectItem>
                              <SelectItem value="approved">Completed</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Parent request status</Label>
                          <Select
                            value={signatureClearanceStatus}
                            onValueChange={(v) =>
                              setSignatureClearanceStatus(v as typeof signatureClearanceStatus)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In progress</SelectItem>
                              <SelectItem value="approved">Completed</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="all-dates"
                      checked={allDates}
                      onCheckedChange={(c) => setAllDates(c === true)}
                    />
                    <label htmlFor="all-dates" className="text-sm font-medium leading-none cursor-pointer">
                      Include all dates (ignore range)
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2 ml-auto">
                    <Button type="button" variant="outline" onClick={handleGenerate} disabled={loading}>
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Generate report
                    </Button>
                    {activeTab === 'clearances' ? (
                      <Button type="button" onClick={exportClearancesCsv} disabled={loading || clearanceRows.length === 0}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    ) : (
                      <Button type="button" onClick={exportSignaturesCsv} disabled={loading || signatureRows.length === 0}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    )}
                  </div>
                </div>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {activeTab === 'clearances' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(
                    [
                      ['Pending', clearanceSummary.pending],
                      ['In progress', clearanceSummary.in_progress],
                      ['Completed', clearanceSummary.approved],
                      ['Rejected', clearanceSummary.rejected],
                    ] as const
                  ).map(([label, n]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-border/60 bg-card px-4 py-3 text-center shadow-sm"
                    >
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      <p className="text-2xl font-semibold tabular-nums mt-1">{n}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                      Preview
                    </CardTitle>
                    {clearanceRows.length > previewLimit && (
                      <p className="text-xs text-muted-foreground">
                        Showing first {previewLimit} of {clearanceRows.length} — export CSV for the full list
                      </p>
                    )}
                  </div>
                  <ScrollArea className="w-full rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clearancePreview.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                              Run <strong>Generate report</strong> to load data.
                            </TableCell>
                          </TableRow>
                        ) : (
                          clearancePreview.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium max-w-[220px] truncate">{r.title}</TableCell>
                              <TableCell>
                                <div className="text-sm">{r.profiles?.full_name ?? '—'}</div>
                                <div className="text-xs text-muted-foreground">{r.profiles?.student_id ?? ''}</div>
                              </TableCell>
                              <TableCell>{statusBadge(r.status)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy HH:mm') : '—'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              </>
            )}

            {activeTab === 'signatures' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(
                    [
                      ['Pending', signatureSummary.pending],
                      ['In progress', signatureSummary.in_progress],
                      ['Completed', signatureSummary.approved],
                      ['Rejected', signatureSummary.rejected],
                    ] as const
                  ).map(([label, n]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-border/60 bg-card px-4 py-3 text-center shadow-sm"
                    >
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      <p className="text-2xl font-semibold tabular-nums mt-1">{n}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                      Preview
                    </CardTitle>
                    {signatureRows.length > previewLimit && (
                      <p className="text-xs text-muted-foreground">
                        Showing first {previewLimit} of {signatureRows.length} — export CSV for the full list
                      </p>
                    )}
                  </div>
                  <ScrollArea className="w-full rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Signatory</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Clearance</TableHead>
                          <TableHead>Step</TableHead>
                          <TableHead>Signed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {signaturePreview.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                              Run <strong>Generate report</strong> to load data.
                            </TableCell>
                          </TableRow>
                        ) : (
                          signaturePreview.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell>
                                <div className="text-sm font-medium">{r.signatories?.name ?? '—'}</div>
                                <div className="text-xs text-muted-foreground">{r.signatories?.department ?? ''}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{r.student.full_name}</div>
                                <div className="text-xs text-muted-foreground">{r.student.student_id ?? ''}</div>
                              </TableCell>
                              <TableCell className="max-w-[180px] truncate text-sm">{r.clearance.title}</TableCell>
                              <TableCell>{statusBadge(r.status)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {r.signed_at
                                  ? format(new Date(r.signed_at), 'MMM d, yyyy HH:mm')
                                  : r.created_at
                                    ? format(new Date(r.created_at), 'MMM d, yyyy')
                                    : '—'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
