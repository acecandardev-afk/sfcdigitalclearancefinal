import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Loader2, FileText, Search, Eye } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { InstitutionalPageBrand } from '@/institutional_clearance/InstitutionalPageBrand';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { parseResponseJson } from '@/lib/parseResponseJson';
import { useUserRole } from '@/hooks/useUserRole';
import { canCreateOwnInstitutionalClearanceRequest } from '@/lib/permissionsMatrix';
import { friendlyApiErrorMessage, friendlyFetchError } from '@/lib/userMessages';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Row = {
  id: string;
  fullName: string;
  position: string;
  department: string;
  status: string;
  createdAt: string;
  requester: { email: string; full_name: string | null };
};

export default function InstitutionalListPage() {
  const { roles } = useUserRole();
  const canStartOwnRequest = canCreateOwnInstitutionalClearanceRequest(roles);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/institutional/clearances', { credentials: 'include' });
        const j = (await parseResponseJson(res)) as { clearances?: Row[] };
        if (!res.ok) throw new Error(await friendlyApiErrorMessage(res, 'Could not load your clearance requests.'));
        if (!cancelled) setRows(j.clearances ?? []);
      } catch (e) {
        if (!cancelled) setErr(friendlyFetchError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filter === 'pending') return r.status === 'pending' || r.status === 'in_progress';
        if (filter === 'completed') return r.status === 'completed';
        return true;
      })
      .filter((r) => {
        if (!q) return true;
        return (
          r.fullName.toLowerCase().includes(q) ||
          r.position.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q)
        );
      });
  }, [rows, filter, query]);

  return (
    <DashboardLayout>
      <div className="app-page min-h-screen w-full min-w-0 bg-gradient-to-br from-slate-50/80 via-blue-50/20 to-transparent px-4 py-6 dark:from-gray-950/50 dark:via-gray-900/30 sm:px-6 lg:px-8">
        <div className="w-full min-w-0 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <InstitutionalPageBrand
                title="My Clearance"
                subtitle="Track your institutional clearance requests and open any record to view progress."
              />
            </div>
            {canStartOwnRequest && (
            <Button asChild className="w-full shrink-0 sm:w-auto">
              <Link to="/dashboard/institutional/clearances/new">
                <Plus className="h-4 w-4 mr-2" />
                New request
              </Link>
            </Button>
            )}
          </div>
          {err && (
            <p className="text-sm text-destructive" role="alert">
              {err}
            </p>
          )}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Card className="border-border bg-card">
              <CardHeader className="space-y-3">
                <CardTitle className="text-base">My requests</CardTitle>
                <CardDescription>
                  Follow up your requests by status and open details in one click.
                </CardDescription>
                <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'pending' | 'completed')}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="completed">Signed</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="relative max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, office, position, status"
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredRows.length === 0 ? (
                  <div className="py-10 text-center">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      {rows.length === 0 ? 'No requests yet' : 'No matching requests.'}
                    </p>
                    {rows.length === 0 && canStartOwnRequest && (
                      <Button asChild variant="outline" className="mt-4">
                        <Link to="/dashboard/institutional/clearances/new">Create first request</Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto [scrollbar-gutter:stable]">
                    <Table className="min-w-[860px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Department / Office</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.map((r) => (
                          <TableRow key={r.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{r.fullName}</TableCell>
                            <TableCell>{r.position}</TableCell>
                            <TableCell>{r.department}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {r.status.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {format(new Date(r.createdAt), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button asChild size="sm" className="gap-1.5">
                                <Link to={`/dashboard/institutional/clearances/${r.id}`}>
                                  <Eye className="h-3.5 w-3.5" />
                                  View
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
