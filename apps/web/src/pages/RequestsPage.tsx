import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NewRequestDialog } from "@/components/requests/NewRequestDialog";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { fetchMyRequests, cancelMeetingRequest, acceptAlternative, declineAlternative } from "@/lib/meetingRequestsApi";
import { ApiRequestError } from "@/lib/apiClient";

export function RequestsPage() {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["my-requests"],
    queryFn: fetchMyRequests,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["my-requests"] });
    setShowNew(false);
  }

  async function handleCancel(id: string) {
    try {
      await cancelMeetingRequest(id);
      invalidate();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not cancel");
    }
  }

  async function handleAccept(id: string) {
    try {
      await acceptAlternative(id);
      invalidate();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not accept");
    }
  }

  async function handleDecline(id: string) {
    try {
      await declineAlternative(id);
      invalidate();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not decline");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Meeting Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Request time and track your requests.</p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New request
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && requests.length === 0 && (
        <p className="text-sm text-muted-foreground">No requests yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {requests.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex flex-col gap-2 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.category}
                    {r.projectName ? ` · ${r.projectName}` : ""} · {r.durationMinutes} min · {r.format === "online" ? "Online" : "In person"}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <p className="text-sm text-muted-foreground">
                {new Date(r.start).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>

              {r.status === "alternative_proposed" && r.alternativeStart && (
                <div className="rounded-md bg-sky-50 px-3 py-2 text-sm dark:bg-sky-950">
                  <p>
                    New time proposed:{" "}
                    {new Date(r.alternativeStart).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  {r.alternativeNote && <p className="text-muted-foreground">{r.alternativeNote}</p>}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => handleAccept(r.id)}>
                      Accept
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleDecline(r.id)}>
                      Decline
                    </Button>
                  </div>
                </div>
              )}

              {r.status === "approved" && r.meetUrl && (
                <p className="text-sm">
                  Join:{" "}
                  <a href={r.meetUrl} className="underline" target="_blank" rel="noreferrer">
                    {r.meetUrl}
                  </a>
                </p>
              )}

              {["pending", "approved", "alternative_proposed"].includes(r.status) && (
                <div>
                  <Button size="sm" variant="secondary" onClick={() => handleCancel(r.id)}>
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {showNew && <NewRequestDialog onClose={() => setShowNew(false)} onCreated={invalidate} />}
    </div>
  );
}
