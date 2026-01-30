import DashboardLayout from '@/components/layout/DashboardLayout';
import SignatoryDashboard from '@/components/dashboard/SignatoryDashboard';

export default function PendingRequests() {
  return (
    <DashboardLayout>
      <SignatoryDashboard />
    </DashboardLayout>
  );
}
