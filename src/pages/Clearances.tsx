import DashboardLayout from '@/components/layout/DashboardLayout';
import MyClearancePage from '@/components/clearance/my-clearance/MyClearancePage';

export default function Clearances() {
  return (
    <DashboardLayout>
      <div className="app-page min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <MyClearancePage />
      </div>
    </DashboardLayout>
  );
}
