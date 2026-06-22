import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Clock, LayoutGrid, List, Loader2, Paperclip, Search } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { InstitutionalPageBrand } from '@/institutional_clearance/InstitutionalPageBrand';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { parseResponseJson } from '@/lib/parseResponseJson';
import { friendlyApiErrorMessage, friendlyFetchError } from '@/lib/userMessages';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import { useSignatoryPendingCounts } from '@/hooks/useSignatoryPendingCounts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Entry = {
  clearance: {
    id: string;
    fullName: string;
    position: string;
    department: string;
    status: string;
    createdAt: string;
    requester: { id?: string; email: string; full_name: string | null };
    attachmentCount?: number;
  };
  item: {
    id: string;
    signatoryName: string;
    signatoryDepartment: string;
    sortOrder: number;
    status: string;
    departmentLabel: string;
    approvedAt: string | null;
  };
  blockedReason?: string;
};

type TabKey = 'signed' | 'pending' | 'rejected';
type QueueResponse = {
  toSign: Entry[];
  waiting: Entry[];
  history: Entry[];
  mode?: 'requester' | 'signatory';
};

export default function InstitutionalSignatoryQueuePage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { roles } = useUserRole();
  const studentQueueHint = useSignatoryPendingCounts({
    fetchStudent: roles.includes('signatory'),
    fetchInstitutional: false,
  });
  const defaultTab: TabKey = pathname.includes('/signed') ? 'signed' : 'pending';
  const [tab, setTab] = useState<TabKey>(defaultTab);
  const [toSign, setToSign] = useState<Entry[]>([]);
  const [waiting, setWaiting] = useState<Entry[]>([]);
  const [history, setHistory] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    if (pathname.includes('/signed')) {
      setTab('signed');
    } else {
      setTab((prev) => (prev === 'rejected' && pathname.includes('/pending') ? 'rejected' : 'pending'));
    }
  }, [pathname]);

  useEffect(() => {
    let a = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/institutional/signatory/queue', { credentials: 'include' });
        const j = (await parseResponseJson(res)) as QueueResponse;
        if (!res.ok) throw new Error(await friendlyApiErrorMessage(res, 'Failed to load queue'));
        if (a) {
          setToSign(j.toSign ?? []);
          setWaiting(j.waiting ?? []);
          setHistory(j.history ?? []);
        }
      } catch (e) {
        if (a) {
          setErr(friendlyFetchError(e));
          toast.error('Could not load institutional signatory queue');
        }
      } finally {
        if (a) setLoading(false);
      }
    })();
    return () => {
      a = false;
    };
  }, []);

  const filterEntries = useCallback((entries: Entry[]) => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const matchesQuery =
        !q ||
        e.clearance.fullName.toLowerCase().includes(q) ||
        e.item.signatoryName.toLowerCase().includes(q) ||
        e.item.signatoryDepartment.toLowerCase().includes(q) ||
        e.item.departmentLabel.toLowerCase().includes(q);
      return matchesQuery;
    });
  }, [query]);

  const requesterKey = useCallback((e: Entry) => {
    return e.clearance.requester.id || e.clearance.requester.email || e.clearance.fullName;
  }, []);

  const actionableRequesterKeys = useMemo(() => {
    return new Set(toSign.map((e) => requesterKey(e)));
  }, [toSign, requesterKey]);

  const pendingEntries = useMemo(
    () => {
      const filtered = filterEntries([...toSign, ...waiting].filter((e) => e.item.status === 'pending'));
      const seen = new Set<string>();
      const unique: Entry[] = [];
      for (const e of filtered) {
        const clearanceKey = e.clearance.id;
        if (seen.has(clearanceKey)) continue;
        seen.add(clearanceKey);
        unique.push(e);
      }
      return unique;
    },
    [toSign, waiting, filterEntries]
  );
  const signedEntries = useMemo(
    () => filterEntries(history.filter((e) => e.item.status === 'approved' || e.item.status === 'waived')),
    [history, filterEntries]
  );
  const rejectedEntries = useMemo(
    () => filterEntries(history.filter((e) => e.item.status === 'rejected')),
    [history, filterEntries]
  );

  const Section = ({
    title,
    desc,
    icon: Icon,
    entries,
    empty,
  }: {
    title: string;
    desc: string;
    icon: typeof Bell;
    entries: Entry[];
    empty: string;
  }) => (
    <Card className="border-border/70 bg-gradient-to-b from-card to-card/95 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-[#1e3a5f] dark:text-sky-400" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{empty}</p>
        ) : viewMode === 'cards' ? (
          <ul className="space-y-2">
            {entries.map((e) => {
              const actionable = actionableRequesterKeys.has(requesterKey(e));
              return (
                <li
                  key={`${e.clearance.id}-${e.item.id}`}
                  className="group flex flex-col gap-3 rounded-xl border border-border/80 bg-background px-3 py-3 transition-all hover:border-primary/40 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-base font-semibold text-foreground">{e.clearance.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.item.departmentLabel} • {e.item.signatoryName || 'Assigned signatory'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.item.signatoryDepartment || 'Department not set'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {actionable && tab === 'pending' && (
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Actionable</Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className="text-xs capitalize ring-1 ring-inset ring-primary/10"
                    >
                      {e.item.status.replace(/_/g, ' ')}
                    </Badge>
                    {Boolean(e.clearance.attachmentCount) && (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                      >
                        <Link to={`/dashboard/institutional/signatory/clearances/${e.clearance.id}#supporting-documents`}>
                          <Paperclip className="h-3.5 w-3.5" />
                          Attachment{(e.clearance.attachmentCount ?? 0) > 1 ? 's' : ''}
                        </Link>
                      </Button>
                    )}
                    <Button asChild size="sm" className="shadow-sm transition-transform group-hover:scale-[1.02]">
                      <Link to={`/dashboard/institutional/signatory/clearances/${e.clearance.id}`}>View</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[780px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Signatory</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const actionable = actionableRequesterKeys.has(requesterKey(e));
                  return (
                    <TableRow key={`${e.clearance.id}-${e.item.id}`}>
                      <TableCell className="font-medium">{e.clearance.fullName}</TableCell>
                      <TableCell>{e.item.departmentLabel}</TableCell>
                      <TableCell>{e.item.signatoryName || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {actionable && tab === 'pending' && (
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Actionable</Badge>
                          )}
                          <Badge variant="secondary" className="capitalize">
                            {e.item.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          {Boolean(e.clearance.attachmentCount) && (
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/dashboard/institutional/signatory/clearances/${e.clearance.id}#supporting-documents`}>
                                <Paperclip className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          )}
                          <Button asChild size="sm">
                            <Link to={`/dashboard/institutional/signatory/clearances/${e.clearance.id}`}>View</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="flex min-h-full w-full min-w-0 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-full w-full min-w-0 flex-1 flex-col space-y-8">
          <InstitutionalPageBrand
            title="Institutional — signatory work queue"
            subtitle="Employee exit (institutional) clearances only. Student clearance signatures are under Student clearance — To sign in the sidebar."
          />
          {studentQueueHint.studentPending != null && studentQueueHint.studentPending > 0 && (
            <Alert className="border-sky-500/40 bg-sky-500/5">
              <AlertTitle>Looking for student clearance requests?</AlertTitle>
              <AlertDescription className="text-sm leading-relaxed">
                This page lists <strong>employee exit</strong> clearances only. You have{' '}
                <strong>{studentQueueHint.studentPending}</strong> student clearance signature
                {studentQueueHint.studentPending === 1 ? '' : 's'} pending — open{' '}
                <Link to="/dashboard/requests" className="font-semibold text-primary underline underline-offset-2">
                  Student clearance — To sign
                </Link>
                .
              </AlertDescription>
            </Alert>
          )}
          {err && (
            <p className="text-sm text-destructive" role="alert">
              {err}
            </p>
          )}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-border/80 bg-gradient-to-br from-sky-500/5 to-transparent">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Pending</p>
                      <p className="text-xl font-semibold">{pendingEntries.length}</p>
                    </div>
                    <Clock className="h-4 w-4 text-primary" />
                  </CardContent>
                </Card>
                <Card className="border-border/80 bg-gradient-to-br from-emerald-500/5 to-transparent">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Signed</p>
                      <p className="text-xl font-semibold">{signedEntries.length}</p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </CardContent>
                </Card>
                <Card className="border-border/80 bg-gradient-to-br from-rose-500/5 to-transparent">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Rejected</p>
                      <p className="text-xl font-semibold">{rejectedEntries.length}</p>
                    </div>
                    <Bell className="h-4 w-4 text-primary" />
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-lg">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search requester, office, or signatory"
                        className="pl-9"
                      />
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={viewMode === 'cards' ? 'default' : 'ghost'}
                        onClick={() => setViewMode('cards')}
                        className="h-8 gap-1.5"
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Cards
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={viewMode === 'table' ? 'default' : 'ghost'}
                        onClick={() => setViewMode('table')}
                        className="h-8 gap-1.5"
                      >
                        <List className="h-3.5 w-3.5" />
                        Table
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs
                value={tab}
                onValueChange={(v) => {
                  const next = v as TabKey;
                  setTab(next);
                  if (next === 'signed') {
                    navigate('/dashboard/institutional/signed', { replace: true });
                  } else {
                    navigate('/dashboard/institutional/pending', { replace: true });
                  }
                }}
                className="space-y-4"
              >
              <TabsList className="grid h-auto w-full max-w-full grid-cols-1 gap-1 p-1 sm:h-10 sm:max-w-md sm:grid-cols-3 sm:gap-0 sm:p-1">
                <TabsTrigger value="signed">Signed</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
              </TabsList>
              <TabsContent value="signed" className="mt-0">
                <Section
                  title="Signed"
                  desc="Rows already completed by assigned signatories."
                  icon={Bell}
                  entries={signedEntries}
                  empty="No signed rows yet for your requests."
                />
              </TabsContent>
              <TabsContent value="pending" className="mt-0">
                <Section
                  title="Pending"
                  desc="All employee requests are listed here. You can open each record and sign only the rows assigned to your signatory role."
                  icon={Clock}
                  entries={pendingEntries}
                  empty="No pending rows."
                />
              </TabsContent>
              <TabsContent value="rejected" className="mt-0">
                <Section
                  title="Rejected"
                  desc="Rows that were rejected by signatories."
                  icon={CheckCircle2}
                  entries={rejectedEntries}
                  empty="No rejected rows."
                />
              </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
