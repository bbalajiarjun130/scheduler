import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, Unlink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchGoogleStatus, getGoogleConnectUrl, disconnectGoogle } from "@/lib/integrationsApi";
import { ApiRequestError } from "@/lib/apiClient";
import { SchedulingSettingsForm } from "@/components/settings/SchedulingSettingsForm";

export function AdminSettingsPage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["integrations", "google"],
    queryFn: fetchGoogleStatus,
  });

  useEffect(() => {
    const result = params.get("google");
    if (result === "connected") {
      setBanner({ type: "success", text: "Google Calendar connected." });
      queryClient.invalidateQueries({ queryKey: ["integrations", "google"] });
    } else if (result === "error") {
      setBanner({ type: "error", text: "Couldn't connect Google Calendar. Please try again." });
    }
    if (result) {
      params.delete("google");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const url = await getGoogleConnectUrl();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not start Google sign-in");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await disconnectGoogle();
    queryClient.invalidateQueries({ queryKey: ["integrations", "google"] });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Integrations and platform-wide scheduling defaults.</p>

      {banner && (
        <div
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            banner.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {banner.text}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Google Calendar &amp; Meet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            When connected, approving an online meeting creates a Google Calendar event with an automatic Meet link
            and invites the requester. Rescheduling or cancelling from the calendar keeps Google in sync.
          </p>

          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

          {!isLoading && status && (
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="flex items-center gap-3">
                <CalendarCheck2
                  size={20}
                  className={status.connected ? "text-emerald-600" : "text-muted-foreground"}
                />
                <div>
                  <p className="text-sm font-medium">
                    {status.status === "connected" && "Connected"}
                    {status.status === "needs_reauth" && "Needs reconnection"}
                    {status.status === "disconnected" && "Not connected"}
                  </p>
                  {status.googleEmail && <p className="text-xs text-muted-foreground">{status.googleEmail}</p>}
                  {status.status === "needs_reauth" && (
                    <p className="text-xs text-red-600">
                      Google revoked or expired access — reconnect to resume syncing.
                    </p>
                  )}
                </div>
              </div>

              {status.connected || status.status === "needs_reauth" ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={handleConnect} disabled={connecting}>
                    Reconnect
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleDisconnect}>
                    <Unlink size={14} /> Disconnect
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={handleConnect} disabled={connecting}>
                  {connecting ? "Redirecting..." : "Connect Google Calendar"}
                </Button>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <SchedulingSettingsForm />
    </div>
  );
}
