import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ClipboardList, FileText, ListTree, Shield } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { InstitutionalPageBrand } from '@/institutional_clearance/InstitutionalPageBrand';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { parseResponseJson } from '@/lib/parseResponseJson';
import { friendlyApiErrorMessage, friendlyFetchError } from '@/lib/userMessages';

type Row = {
  id: string;
  fullName: string;
  status: string;
  createdAt: string;
};

export default function InstitutionalAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let a = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/institutional/clearances', { credentials: 'include' });
        const j = await parseResponseJson(res);
        if (!res.ok) throw new Error(await friendlyApiErrorMessage(res, 'Could not load clearance records.'));
        if (a) setRows((j.clearances ?? []) as Row[]);
      } catch (e) {
        if (a) setErr(friendlyFetchError(e));
      } finally {
        if (a) setLoading(false);
      }
    })();
    return () => {
      a = false;
    };
  }, []);

  const stats = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      total: rows.length,
      draft: by('draft'),
      inProgress: by('in_progress'),
      completed: by('completed'),
    };
  }, [rows]);

  return (
    <DashboardLayout>
      <div className="w-full min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <div className="w-full min-w-0 space-y-8">
          <InstitutionalPageBrand
            title="Institutional clearance — admin"
            subtitle="Monitor all employee / institutional exit clearances, open any record, and support signatories. Sequential signing is enforced in the line items."
          />
          {err && <p className="text-sm text-destructive">{err}</p>}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 text-[#1e3a5f] dark:text-sky-400">
                      <Shield className="h-5 w-5" />
                      <CardTitle className="text-base">All records</CardTitle>
                    </div>
                    <CardDescription>Total, draft, in progress, completed</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    <p>
                      <span className="font-semibold text-foreground">{stats.total}</span> total
                    </p>
                    <p>Draft: {stats.draft} · In progress: {stats.inProgress} · Done: {stats.completed}</p>
                    <Button asChild className="mt-3" variant="secondary">
                      <Link to="/dashboard/institutional/clearances">
                        <ClipboardList className="h-4 w-4 mr-2" />
                        Open full list
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 text-[#1e3a5f] dark:text-sky-400">
                      <FileText className="h-5 w-5" />
                      <CardTitle className="text-base">New requests</CardTitle>
                    </div>
                    <CardDescription>
                      Exit clearance forms are started by employees from their account (My Clearance → New request).
                      Administrators open and manage existing records from the full list.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="secondary">
                      <Link to="/dashboard/institutional/clearances">Open full list</Link>
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 text-[#1e3a5f] dark:text-sky-400">
                      <ListTree className="h-5 w-5" />
                      <CardTitle className="text-base">Section II template</CardTitle>
                    </div>
                    <CardDescription>
                      Configure the office/department list and which signatory signs each line for new clearances.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="secondary">
                      <Link to="/dashboard/institutional/settings/offices">Edit offices</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold text-foreground mb-2">Recent</h2>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No institutional clearances yet.</p>
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {rows.slice(0, 8).map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2"
                      >
                        <div className="min-w-0">
                          <span className="font-medium break-words">{r.fullName}</span>
                          <span className="mt-0.5 block text-muted-foreground sm:mt-0 sm:ml-2 sm:inline">
                            {r.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <Button asChild size="sm" variant="link" className="h-auto w-fit shrink-0 self-start p-0 sm:self-center">
                          <Link to={`/dashboard/institutional/clearances/${r.id}`}>View</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
