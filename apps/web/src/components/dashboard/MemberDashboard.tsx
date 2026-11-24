import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { Tooltip } from "@/components/ui/tooltip";
import { fetchMyRequests } from "@/lib/meetingRequestsApi";
import { fetchMyProjects } from "@/lib/projectsApi";
import { useAuth } from "@/lib/auth";
import { WelcomeBanner } from "./WelcomeBanner";

export function MemberDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ["my-requests"],
    queryFn: fetchMyRequests,
  });
  const { data: projects = [] } = useQuery({ queryKey: ["my-projects"], queryFn: fetchMyProjects });

  const upcoming = requests.filter((r) => r.status === "approved" && new Date(r.start) > new Date());
  const needsAttention = requests.filter((r) => r.status === "pending" || r.status === "alternative_proposed");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back, {user?.name?.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's where things stand.</p>
        </div>
        <Tooltip text="Pick a category, see real open times, and submit a request for the administrator to approve">
          <Button size="sm" onClick={() => navigate("/requests")}>
            <Plus size={14} /> New request
          </Button>
        </Tooltip>
      </div>

      <WelcomeBanner role="user" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs your attention</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {!loadingRequests && needsAttention.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing pending.</p>
            )}
            {needsAttention.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate("/requests")}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-left hover:bg-muted"
              >
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.start).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming meetings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {!loadingRequests && upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">No approved meetings coming up.</p>
            )}
            {upcoming.map((r) => (
              <div key={r.id} className="rounded-md border border-border px-3 py-2">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.start).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {r.meetUrl && (
                  <a href={r.meetUrl} target="_blank" rel="noreferrer" className="text-xs underline">
                    Join link
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Your projects</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {projects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No projects yet — the administrator grants access per project.
              </p>
            )}
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate("/projects")}
                className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 text-left hover:bg-muted"
              >
                <FolderKanban size={14} style={{ color: p.color }} />
                <span className="text-sm font-medium">{p.name}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
