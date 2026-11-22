import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, useLogout } from "@/lib/auth";

export function PendingPage() {
  const { user } = useAuth();
  const logout = useLogout();

  if (user && user.status === "approved") return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Registration {user?.status}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          {user?.status === "pending" && (
            <p>Your account is awaiting administrator approval. You'll be notified once it's reviewed.</p>
          )}
          {user?.status === "rejected" && <p>Your registration was not approved.</p>}
          {(user?.status === "suspended" || user?.status === "deactivated") && (
            <p>Your account access has been {user.status}. Contact the administrator for details.</p>
          )}
          <dl className="grid grid-cols-2 gap-1 text-xs">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{user?.name}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user?.email}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="capitalize">{user?.status}</dd>
          </dl>
          <Button
            variant="secondary"
            onClick={() => logout().then(() => window.location.assign("/login"))}
            className="mt-2"
          >
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
