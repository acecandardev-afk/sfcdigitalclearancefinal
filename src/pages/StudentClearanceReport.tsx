import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useClearancePeriodSettings } from '@/hooks/useClearancePeriodSettings';
import { useStudentMyClearanceData } from '@/hooks/useStudentMyClearanceData';
import { Loader2, ArrowLeft, Printer } from 'lucide-react';

export default function StudentClearanceReport() {
  const { loading, rows } = useStudentMyClearanceData();
  const { period, loading: periodLoading } = useClearancePeriodSettings();

  return (
    <DashboardLayout>
      <div className="app-page min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 px-4 py-6 print:bg-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/clearances" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                My Clearance
              </Link>
            </Button>
            {rows.length > 0 && (
              <Button type="button" onClick={() => window.print()} className="bg-[#1a3c5e] hover:bg-[#15304d]">
                <Printer className="mr-2 h-4 w-4" />
                Print / Save PDF
              </Button>
            )}
          </div>

          <header className="border-b border-gray-200 pb-4 dark:border-gray-700 print:border-gray-300">
            <h1 className="text-2xl font-semibold text-[#1a3c5e] dark:text-blue-400 print:text-black">
              Student clearance report
            </h1>
            <p className="mt-1 text-sm text-muted-foreground print:text-gray-600">
              {periodLoading
                ? 'Period: loading…'
                : period
                  ? `Period: ${period.start.toLocaleDateString()} – ${period.end.toLocaleDateString()}`
                  : 'Period: not configured (set in System Settings)'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground print:text-gray-500">
              Generated {new Date().toLocaleString()}
            </p>
          </header>

          {loading || periodLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-[#1a3c5e] dark:text-blue-400" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clearance steps assigned.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 print:shadow-none">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80">
                    <th className="px-4 py-3 font-semibold">Office / official</th>
                    <th className="px-4 py-3 font-semibold">Officer</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Schedule</th>
                    <th className="px-4 py-3 font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 font-medium">{r.office}</td>
                      <td className="max-w-[200px] px-4 py-3 text-muted-foreground">{r.officer}</td>
                      <td className="px-4 py-3">{r.uiStatus}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{r.date}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.schedule}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground" title={r.remarks}>
                        {r.remarks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
