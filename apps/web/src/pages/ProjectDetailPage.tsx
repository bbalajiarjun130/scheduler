import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { EventListItem } from "@/components/calendar/EventListItem";
import { fetchProject, updateProject, deleteProject, addCollaborator, removeCollaborator } from "@/lib/projectsApi";
import { fetchUsers } from "@/lib/usersApi";
import { fetchEvents } from "@/lib/eventsApi";
import { ApiRequestError } from "@/lib/apiClient";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id!),
    enabled: Boolean(id),
  });

  const { data: approvedUsers = [] } = useQuery({
    queryKey: ["users", "approved"],
    queryFn: () => fetchUsers("approved"),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["project-sessions", id],
    queryFn: () => {
      const now = new Date();
      const start = new Date(now);
      start.setMonth(start.getMonth() - 2);
      const end = new Date(now);
      end.setMonth(end.getMonth() + 3);
      return fetchEvents(start, end);
    },
    enabled: Boolean(id),
  });

  const projectSessions = sessions.filter((e) => e.projectId === id);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["project", id] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  async function handleAddCollaborator() {
    if (!selectedUserId || !id) return;
    try {
      await addCollaborator(id, selectedUserId);
      setSelectedUserId("");
      invalidate();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not add collaborator");
    }
  }

  async function handleRemoveCollaborator(userId: string) {
    if (!id) return;
    await removeCollaborator(id, userId);
    invalidate();
  }

  async function handleToggleArchive() {
    if (!id || !project) return;
    await updateProject(id, { archived: !project.archived });
    invalidate();
  }

  async function handleDelete() {
    if (!id) return;
    await deleteProject(id);
    navigate("/projects");
  }

  if (!project) return <div className="px-6 py-8 text-sm text-muted-foreground">Loading...</div>;

  const availableToAdd = approvedUsers.filter((u) => !project.collaborators.some((c) => c.id === u.id));

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <button
        onClick={() => navigate("/projects")}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to projects
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            {project.category && <p className="text-sm text-muted-foreground">{project.category}</p>}
          </div>
          {project.archived && <span className="rounded-full bg-muted px-2 py-1 text-xs">Archived</span>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowEdit(true)}>
            Edit
          </Button>
          <Button size="sm" variant="secondary" onClick={handleToggleArchive}>
            {project.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            {project.archived ? "Unarchive" : "Archive"}
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {project.description && <p>{project.description}</p>}
              <div className="flex gap-6 text-muted-foreground">
                {project.startDate && <p>Start: {new Date(project.startDate).toLocaleDateString()}</p>}
                {project.deadline && <p>Deadline: {new Date(project.deadline).toLocaleDateString()}</p>}
              </div>
              <div className="mt-2 flex gap-4">
                <div className="rounded-md bg-muted px-3 py-2">
                  <p className="text-xs text-muted-foreground">Scheduled hours</p>
                  <p className="text-lg font-semibold">{project.totalScheduledHours}</p>
                </div>
                <div className="rounded-md bg-muted px-3 py-2">
                  <p className="text-xs text-muted-foreground">Completed hours</p>
                  <p className="text-lg font-semibold">{project.totalCompletedHours}</p>
                </div>
              </div>
              {project.notes && (
                <div className="mt-2 rounded-md border border-dashed border-border px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground">Private notes</p>
                  <p className="mt-1 whitespace-pre-wrap">{project.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work sessions & meetings</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {projectSessions.length === 0 && (
                <p className="text-sm text-muted-foreground">No scheduled sessions in the nearby range.</p>
              )}
              {projectSessions.map((e) => (
                <EventListItem key={e.id} event={e} />
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Collaborators</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {project.collaborators.length === 0 && (
              <p className="text-sm text-muted-foreground">No collaborators assigned.</p>
            )}
            {project.collaborators.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.email}</p>
                </div>
                <button
                  onClick={() => handleRemoveCollaborator(c.id)}
                  className="text-xs text-muted-foreground underline hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}

            <div className="mt-2 flex gap-2">
              <Select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                <option value="">Add collaborator...</option>
                {availableToAdd.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={handleAddCollaborator} disabled={!selectedUserId}>
                <Plus size={14} />
              </Button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </CardContent>
        </Card>
      </div>

      {showEdit && <ProjectFormDialog project={project} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); invalidate(); }} />}
    </div>
  );
}
