import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProviderWithBridge } from "@/lib/auth";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Clearances from "./pages/Clearances";
import StudentClearanceCalendar from "./pages/StudentClearanceCalendar";
import StudentClearanceReport from "./pages/StudentClearanceReport";
import ClearanceDetail from "./pages/ClearanceDetail";
import Signatories from "./pages/Signatories";
import Students from "./pages/Students";
import Settings from "./pages/Settings";
import AccountSettings from "./pages/AccountSettings";
import Auth from "./pages/Auth";
import PendingRequests from "./pages/PendingRequests";
import ApprovedClearances from "./pages/ApprovedClearances";
import SignatoryClearanceDetail from "./pages/SignatoryClearanceDetail";
import BulkAssignSignatories from "./pages/BulkAssignSignatories";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProviderWithBridge>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
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
                  <ProtectedRoute roles={["student"]}>
                    <Clearances />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/clearances/calendar"
                element={
                  <ProtectedRoute roles={["student"]}>
                    <StudentClearanceCalendar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/clearances/report"
                element={
                  <ProtectedRoute roles={["student"]}>
                    <StudentClearanceReport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/clearances/new"
                element={
                  <ProtectedRoute roles={["student"]}>
                    <Navigate to="/dashboard/clearances" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/clearances/:id"
                element={
                  <ProtectedRoute roles={["student", "superadmin"]}>
                    <ClearanceDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/requests"
                element={
                  <ProtectedRoute roles={["signatory"]}>
                    <PendingRequests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/requests/:id"
                element={
                  <ProtectedRoute roles={["signatory"]}>
                    <SignatoryClearanceDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/approved"
                element={
                  <ProtectedRoute roles={["signatory"]}>
                    <ApprovedClearances />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/signatories"
                element={
                  <ProtectedRoute roles={["superadmin"]}>
                    <Signatories />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/students"
                element={
                  <ProtectedRoute roles={["superadmin"]}>
                    <Students />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/bulk-assign"
                element={
                  <ProtectedRoute roles={["superadmin"]}>
                    <BulkAssignSignatories />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/reports"
                element={
                  <ProtectedRoute roles={["superadmin"]}>
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
                path="/dashboard/account"
                element={
                  <ProtectedRoute>
                    <AccountSettings />
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProviderWithBridge>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
