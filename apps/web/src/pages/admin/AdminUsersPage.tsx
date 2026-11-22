import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicUser, UserStatus } from "@scheduler/shared";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/apiClient";

const statusTabs: Array<{ value: UserStatus | "all"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
  { value: "deactivated", label: "Deactivated" },
  { value: "all", label: "All" },
];

export function AdminUsersPage() {
  const [tab, setTab] = useState<UserStatus | "all">("pending");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", tab],
    queryFn: () =>
      api.get<{ users: PublicUser[] }>(`/users${tab === "all" ? "" : `?status=${tab}`}`).then((r) => r.users),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/approve`),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/reject`, {}),
    onSuccess: invalidate,
  });
  const suspend = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/suspend`),
    onSuccess: invalidate,
  });
  const reactivate = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/reactivate`),
    onSuccess: invalidate,
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">User Management</h1>
      <p className="mt-1 text-sm text-muted-foreground">Review registrations and manage account access.</p>

      <div className="mt-6 flex gap-1 border-b border-border">
        {statusTabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.value ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No users in this category.</p>
        )}
        {data?.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{u.name}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                {u.status}
              </span>
              {u.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => approve.mutate(u.id)} disabled={approve.isPending}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => reject.mutate(u.id)}
                    disabled={reject.isPending}
                  >
                    Reject
                  </Button>
                </>
              )}
              {u.status === "approved" && u.role !== "admin" && (
                <Button size="sm" variant="secondary" onClick={() => suspend.mutate(u.id)}>
                  Suspend
                </Button>
              )}
              {(u.status === "suspended" || u.status === "deactivated") && (
                <Button size="sm" variant="secondary" onClick={() => reactivate.mutate(u.id)}>
                  Reactivate
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
