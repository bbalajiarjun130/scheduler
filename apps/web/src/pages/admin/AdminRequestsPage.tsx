import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminRequestCard } from "@/components/requests/AdminRequestCard";
import { fetchAllRequests } from "@/lib/meetingRequestsApi";
import type { MeetingRequestView } from "@scheduler/shared";

const tabs: Array<{ value: MeetingRequestView["status"] | "all"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "alternative_proposed", label: "Alternative proposed" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

export function AdminRequestsPage() {
  const [tab, setTab] = useState<MeetingRequestView["status"] | "all">("pending");
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-requests", tab],
    queryFn: () => fetchAllRequests(tab === "all" ? undefined : tab),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Meeting Requests</h1>
      <p className="mt-1 text-sm text-muted-foreground">Review, approve, and manage incoming requests.</p>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
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

      <div className="mt-4 flex flex-col gap-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && requests.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
        {requests.map((r) => (
          <AdminRequestCard key={r.id} request={r} onChanged={invalidate} />
        ))}
      </div>
    </div>
  );
}
