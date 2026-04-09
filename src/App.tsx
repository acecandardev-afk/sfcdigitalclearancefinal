import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import NewClearance from "./pages/NewClearance";
import Clearances from "./pages/Clearances";
import ClearanceDetail from "./pages/ClearanceDetail";
import Signatories from "./pages/Signatories";
import Students from "./pages/Students";
import Settings from "./pages/Settings";
import AccountSettings from "./pages/AccountSettings";
import PendingRequests from "./pages/PendingRequests";
import ApprovedClearances from "./pages/ApprovedClearances";
import SignatoryClearanceDetail from "./pages/SignatoryClearanceDetail";
import BulkAssignSignatories from "./pages/BulkAssignSignatories";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

/** Preserves ?query and #hash (needed for Supabase recovery links). */
function AuthPathToHome() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/", search, hash }} replace />;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPathToHome />} />
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
                  <ProtectedRoute roles={["student", "superadmin"]}>
                    <Clearances />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/clearances/new"
                element={
                  <ProtectedRoute roles={["student"]}>
                    <NewClearance />
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
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
