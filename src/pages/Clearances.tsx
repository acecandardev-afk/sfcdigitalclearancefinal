import DashboardLayout from '@/components/layout/DashboardLayout';
import MyClearancePage from '@/components/clearance/my-clearance/MyClearancePage';

export default function Clearances() {
  return (
    <DashboardLayout>
      {/* Full width of main column (no max-w-7xl) so clearance form and table use horizontal space */}
      <div className="ec-clearance-canvas min-h-screen w-full px-4 py-6 font-clearanceUi sm:px-6 lg:px-8 lg:py-8">
        <MyClearancePage />
      </div>
    </DashboardLayout>
  );
}
