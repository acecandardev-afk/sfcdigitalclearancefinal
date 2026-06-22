import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { parseResponseJson } from '@/lib/parseResponseJson';

type Row = {
  id: string;
  fullName: string;
  position: string;
  department: string;
  status: string;
  createdAt: string;
};

export default function InstitutionalGeneralReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/institutional/clearances', { credentials: 'include' });
        const j = await parseResponseJson(res);
        if (!res.ok) throw new Error('Failed to load');
        if (!cancelled) setRows((j.clearances ?? []) as Row[]);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const generatedAt = useMemo(() => new Date().toLocaleString(), []);

  return (
    <DashboardLayout>
      <div className="app-page min-h-screen space-y-6 print:bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/institutional/clearances" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              My Clearance
            </Link>
          </Button>
          {rows.length > 0 && (
            <Button type="button" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print / Save PDF
            </Button>
          )}
        </div>

        <Card className="print:shadow-none">
          <CardHeader className="border-b print:border-gray-300">
            <CardTitle>Employee General Report</CardTitle>
            <CardDescription>All institutional clearance requests for this employee account.</CardDescription>
            <p className="text-xs text-muted-foreground">Generated {generatedAt}</p>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px] text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.fullName}</TableCell>
                        <TableCell>{r.position}</TableCell>
                        <TableCell>{r.department}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {r.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(r.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

