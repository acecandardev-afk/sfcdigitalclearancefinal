import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import NotFound from "./pages/NotFound";

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
              <Route path="/auth" element={<Navigate to="/?signin=1" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/clearances" element={<Clearances />} />
              <Route path="/dashboard/clearances/new" element={<NewClearance />} />
              <Route path="/dashboard/clearances/:id" element={<ClearanceDetail />} />
              <Route path="/dashboard/requests" element={<PendingRequests />} />
              <Route path="/dashboard/requests/:id" element={<SignatoryClearanceDetail />} />
              <Route path="/dashboard/approved" element={<ApprovedClearances />} />
              <Route path="/dashboard/signatories" element={<Signatories />} />
              <Route path="/dashboard/students" element={<Students />} />
              <Route path="/dashboard/settings" element={<Settings />} />
              <Route path="/dashboard/account" element={<AccountSettings />} />
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
