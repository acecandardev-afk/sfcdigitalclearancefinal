import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Loader2 } from "lucide-react";
import { AuthProviderWithBridge } from "@/lib/auth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import StaffModuleResolver from "@/components/auth/StaffModuleResolver";
import InstitutionalRoute from "@/components/auth/InstitutionalRoute";
import InstitutionalPersonaRoute from "@/components/auth/InstitutionalPersonaRoute";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clearances = lazy(() => import("./pages/Clearances"));
const StudentClearanceCalendar = lazy(() => import("./pages/StudentClearanceCalendar"));
const ClearanceDetail = lazy(() => import("./pages/ClearanceDetail"));
const Signatories = lazy(() => import("./pages/Signatories"));
const Students = lazy(() => import("./pages/Students"));
const Settings = lazy(() => import("./pages/Settings"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const PendingRequests = lazy(() => import("./pages/PendingRequests"));
const ApprovedClearances = lazy(() => import("./pages/ApprovedClearances"));
const SignatoryClearanceDetail = lazy(() => import("./pages/SignatoryClearanceDetail"));
const BulkAssignSignatories = lazy(() => import("./pages/BulkAssignSignatories"));
const Reports = lazy(() => import("./pages/Reports"));
const ArchivedRecords = lazy(() => import("./pages/ArchivedRecords"));
const PreClearanceVerification = lazy(() => import("./pages/PreClearanceVerification"));
const ClearanceSelect = lazy(() => import("./pages/ClearanceSelect"));
const InstitutionalHome = lazy(() => import("./institutional_clearance/InstitutionalHome"));
const InstitutionalSignatoryHome = lazy(() => import("./institutional_clearance/InstitutionalSignatoryHome"));
const InstitutionalListPage = lazy(() => import("./institutional_clearance/InstitutionalListPage"));
const InstitutionalFormPage = lazy(() => import("./institutional_clearance/InstitutionalFormPage"));
const InstitutionalDetailPage = lazy(() => import("./institutional_clearance/InstitutionalDetailPage"));
const InstitutionalSignatoryQueuePage = lazy(() => import("./institutional_clearance/InstitutionalSignatoryQueuePage"));
const InstitutionalAdminPage = lazy(() => import("./institutional_clearance/InstitutionalAdminPage"));
const InstitutionalPrintPage = lazy(() => import("./institutional_clearance/InstitutionalPrintPage"));
const InstitutionalOfficeSettingsPage = lazy(() => import("./institutional_clearance/InstitutionalOfficeSettingsPage"));
const InstitutionalCalendarPage = lazy(() => import("./institutional_clearance/InstitutionalCalendarPage"));
const InstitutionalGeneralReportPage = lazy(() => import("./institutional_clearance/InstitutionalGeneralReportPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProviderWithBridge>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <StaffModuleResolver>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth/student" element={<Auth />} />
              <Route path="/auth/employee" element={<Auth />} />
              <Route path="/auth" element={<Navigate to="/auth/student" replace />} />
              <Route
                path="/dashboard/clearance-select"
                element={
                  <ProtectedRoute>
                    <ClearanceSelect />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/clearances"
                element={
                  <ProtectedRoute requireStudentClearanceRequester>
                    <Clearances />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/clearances/calendar"
                element={
                  <ProtectedRoute requireStudentClearanceRequester>
                    <StudentClearanceCalendar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/clearances/report"
                element={
                  <ProtectedRoute>
                    <Navigate to="/dashboard/clearances" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/clearances/new"
                element={
                  <ProtectedRoute requireStudentClearanceRequester>
                    <Navigate to="/dashboard/clearances" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/clearances/:id"
                element={
                  <ProtectedRoute roles={["student", "superadmin", "faculty_admin", "hr_admin"]}>
                    <ClearanceDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/requests"
                element={
                  <ProtectedRoute
                    roles={['signatory', 'superadmin', 'faculty_admin', 'hr_admin']}
                    requireSignatoryRole
                  >
                    <PendingRequests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/requests/:id"
                element={
                  <ProtectedRoute
                    roles={['signatory', 'superadmin', 'faculty_admin', 'hr_admin']}
                    requireSignatoryRole
                  >
                    <SignatoryClearanceDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/approved"
                element={
                  <ProtectedRoute
                    roles={['signatory', 'superadmin', 'faculty_admin', 'hr_admin']}
                    requireSignatoryRole
                  >
                    <ApprovedClearances />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/signatories"
                element={
                  <ProtectedRoute roles={["superadmin", "faculty_admin", "hr_admin"]}>
                    <Signatories />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/students"
                element={
                  <ProtectedRoute roles={["superadmin", "faculty_admin"]}>
                    <Students />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/pre-clearance"
                element={
                  <ProtectedRoute roles={["superadmin", "faculty_admin", "signatory"]}>
                    <PreClearanceVerification />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/bulk-assign"
                element={
                  <ProtectedRoute roles={["superadmin", "faculty_admin"]}>
                    <BulkAssignSignatories />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/reports"
                element={
                  <ProtectedRoute roles={["superadmin", "faculty_admin", "hr_admin"]}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/settings"
                element={
                  <ProtectedRoute roles={["superadmin"]}>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/archived"
                element={
                  <ProtectedRoute roles={["superadmin"]}>
                    <ArchivedRecords />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/account"
                element={
                  <ProtectedRoute>
                    <AccountSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/notifications"
                element={
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional"
                element={
                  <ProtectedRoute roles={["employee", "signatory", "superadmin", "hr_admin"]}>
                    <InstitutionalRoute>
                      <InstitutionalPersonaRoute persona="employee">
                        <InstitutionalHome />
                      </InstitutionalPersonaRoute>
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/signatory"
                element={
                  <ProtectedRoute
                    roles={['signatory', 'superadmin', 'faculty_admin', 'hr_admin']}
                    requireSignatoryRole
                  >
                    <InstitutionalRoute>
                      <InstitutionalSignatoryHome />
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/clearances"
                element={
                  <ProtectedRoute roles={["employee", "signatory", "superadmin", "hr_admin"]}>
                    <InstitutionalRoute>
                      <InstitutionalPersonaRoute persona="employee">
                        <InstitutionalListPage />
                      </InstitutionalPersonaRoute>
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/clearances/new"
                element={
                  <ProtectedRoute
                    roles={['employee', 'signatory', 'superadmin', 'hr_admin']}
                    requireInstitutionalEmployeeRequester
                  >
                    <InstitutionalRoute>
                      <InstitutionalPersonaRoute persona="employee">
                        <InstitutionalFormPage />
                      </InstitutionalPersonaRoute>
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/clearances/calendar"
                element={
                  <ProtectedRoute roles={["employee", "signatory", "superadmin", "hr_admin"]}>
                    <InstitutionalRoute>
                      <InstitutionalPersonaRoute persona="employee">
                        <InstitutionalCalendarPage />
                      </InstitutionalPersonaRoute>
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/clearances/report"
                element={
                  <ProtectedRoute roles={["employee", "signatory", "superadmin", "hr_admin"]}>
                    <InstitutionalRoute>
                      <InstitutionalPersonaRoute persona="employee">
                        <InstitutionalGeneralReportPage />
                      </InstitutionalPersonaRoute>
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/clearances/:id/print"
                element={
                  <ProtectedRoute roles={["employee", "signatory", "superadmin", "hr_admin"]}>
                    <InstitutionalPersonaRoute persona="employee">
                      <InstitutionalPrintPage />
                    </InstitutionalPersonaRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/signatory/clearances/:id/print"
                element={
                  <ProtectedRoute
                    roles={['signatory', 'superadmin', 'faculty_admin', 'hr_admin']}
                    requireSignatoryRole
                  >
                    <InstitutionalPersonaRoute persona="signatory">
                      <InstitutionalPrintPage />
                    </InstitutionalPersonaRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/clearances/:id/edit"
                element={
                  <ProtectedRoute roles={["employee", "signatory", "superadmin", "hr_admin"]}>
                    <InstitutionalRoute>
                      <InstitutionalPersonaRoute persona="employee">
                        <InstitutionalFormPage />
                      </InstitutionalPersonaRoute>
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/clearances/:id"
                element={
                  <ProtectedRoute roles={["employee", "signatory", "superadmin", "hr_admin"]}>
                    <InstitutionalRoute>
                      <InstitutionalPersonaRoute persona="employee">
                        <InstitutionalDetailPage />
                      </InstitutionalPersonaRoute>
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/signatory/clearances/:id"
                element={
                  <ProtectedRoute
                    roles={['signatory', 'superadmin', 'faculty_admin', 'hr_admin']}
                    requireSignatoryRole
                  >
                    <InstitutionalRoute>
                      <InstitutionalPersonaRoute persona="signatory">
                        <InstitutionalDetailPage />
                      </InstitutionalPersonaRoute>
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/pending"
                element={
                  <ProtectedRoute
                    roles={['signatory', 'superadmin', 'faculty_admin', 'hr_admin']}
                    requireSignatoryRole
                  >
                    <InstitutionalRoute>
                      <InstitutionalSignatoryQueuePage />
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/signed"
                element={
                  <ProtectedRoute
                    roles={['signatory', 'superadmin', 'faculty_admin', 'hr_admin']}
                    requireSignatoryRole
                  >
                    <InstitutionalRoute>
                      <InstitutionalSignatoryQueuePage />
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/admin"
                element={
                  <ProtectedRoute roles={["superadmin", "hr_admin"]}>
                    <InstitutionalRoute>
                      <InstitutionalAdminPage />
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/institutional/settings/offices"
                element={
                  <ProtectedRoute roles={["superadmin", "hr_admin"]}>
                    <InstitutionalRoute>
                      <InstitutionalOfficeSettingsPage />
                    </InstitutionalRoute>
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </StaffModuleResolver>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProviderWithBridge>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
