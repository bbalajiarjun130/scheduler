import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute, RequireAdmin, PublicOnlyRoute } from "@/routes/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { SignupPage } from "@/pages/auth/SignupPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage";
import { PendingPage } from "@/pages/PendingPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { RequestsPage } from "@/pages/RequestsPage";
import { AdminRequestsPage } from "@/pages/admin/AdminRequestsPage";
import { AdminPermissionsPage } from "@/pages/admin/AdminPermissionsPage";
import { AdminSettingsPage } from "@/pages/admin/AdminSettingsPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/pending" element={<PendingPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/requests" element={<RequestsPage />} />

                <Route element={<RequireAdmin />}>
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/admin/requests" element={<AdminRequestsPage />} />
                  <Route path="/admin/permissions" element={<AdminPermissionsPage />} />
                  <Route path="/admin/settings" element={<AdminSettingsPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<PlaceholderPage title="Not found" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
