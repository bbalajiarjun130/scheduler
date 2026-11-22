import { useAuth } from "@/lib/auth";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Welcome back, {user?.name?.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your dashboard overview is coming in the next build phase.
      </p>
    </div>
  );
}
