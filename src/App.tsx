import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Pending from "./pages/Pending";
import Dashboard from "./pages/Dashboard";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminApprovals from "./pages/admin/AdminApprovals";
import AdminDataset from "./pages/admin/AdminDataset";
import AdminPlots from "./pages/admin/AdminPlots";
import AdminAdmins from "./pages/admin/AdminAdmins";
import AdminSettings from "./pages/admin/AdminSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/pending" element={<Pending />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminApprovals />} />
              <Route path="dataset" element={<AdminDataset />} />
              <Route path="plots" element={<AdminPlots />} />
              <Route path="admins" element={<AdminAdmins />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
