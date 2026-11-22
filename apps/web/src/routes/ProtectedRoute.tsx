import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullScreenLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin" && user.status !== "approved") return <Navigate to="/pending" replace />;

  return <Outlet />;
}

export function RequireAdmin() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullScreenLoading />;
  if (!user || user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullScreenLoading />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

function FullScreenLoading() {
  return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>;
}
