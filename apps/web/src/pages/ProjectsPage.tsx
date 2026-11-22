import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { fetchProjects, fetchMyProjects } from "@/lib/projectsApi";
import { useAuth } from "@/lib/auth";

export function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: isAdmin ? ["projects", showArchived] : ["my-projects"],
    queryFn: () => (isAdmin ? fetchProjects(showArchived) : fetchMyProjects()),
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? "Dedicated work, deadlines, and collaborators." : "Projects you have access to."}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant={showArchived ? "primary" : "secondary"} size="sm" onClick={() => setShowArchived((v) => !v)}>
              <Archive size={14} /> {showArchived ? "Showing archived" : "Show archived"}
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} /> New project
            </Button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && projects.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "No projects yet. Create one to get started." : "You don't have access to any projects yet."}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Card
            key={p.id}
            className={isAdmin ? "cursor-pointer hover:border-primary/40" : ""}
            onClick={isAdmin ? () => navigate(`/projects/${p.id}`) : undefined}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <CardTitle className="truncate">{p.name}</CardTitle>
                {p.archived && <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">Archived</span>}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              {p.description && !isAdmin && <p>{p.description}</p>}
              {p.category && <p>{p.category}</p>}
              {p.deadline && <p>Deadline: {new Date(p.deadline).toLocaleDateString()}</p>}
              {isAdmin && (
                <p>
                  {p.totalScheduledHours}h scheduled · {p.totalCompletedHours}h completed
                </p>
              )}
              <p>
                {p.collaborators.length} collaborator{p.collaborators.length === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm && (
        <ProjectFormDialog
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["projects"] });
          }}
        />
      )}
    </div>
  );
}
