import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectPermissionView, UpdateUserPermissionsInput } from "@scheduler/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { HelpHint } from "@/components/ui/tooltip";
import { fetchUsers } from "@/lib/usersApi";
import { fetchProjects } from "@/lib/projectsApi";
import { fetchUserPermissions, updateUserPermissions, updateProjectPermission, revokeProjectPermission } from "@/lib/permissionsApi";

const durationOptions = [15, 30, 45, 60, 90];

export function AdminPermissionsPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: users = [] } = useQuery({ queryKey: ["users", "approved"], queryFn: () => fetchUsers("approved") });
  const members = users.filter((u) => u.role !== "admin");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Permissions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Control exactly what each person can see and request. Nothing is allowed until you grant it.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-1">
          {members.length === 0 && <p className="text-sm text-muted-foreground">No approved users yet.</p>}
          {members.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedUserId(u.id)}
              className={`rounded-md px-3 py-2 text-left text-sm ${
                selectedUserId === u.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
              }`}
            >
              <p className="truncate">{u.name}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
            </button>
          ))}
        </div>

        {selectedUserId ? (
          <UserPermissionsEditor userId={selectedUserId} />
        ) : (
          <p className="text-sm text-muted-foreground">Select a user to edit their permissions.</p>
        )}
      </div>
    </div>
  );
}

function UserPermissionsEditor({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["permissions", userId],
    queryFn: () => fetchUserPermissions(userId),
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects", false], queryFn: () => fetchProjects(false) });

  const [general, setGeneral] = useState<UpdateUserPermissionsInput | null>(null);
  const [addProjectId, setAddProjectId] = useState("");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const current = general ?? data?.userPermissions ?? null;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["permissions", userId] });
  }

  async function saveGeneral() {
    if (!current) return;
    await updateUserPermissions(userId, current);
    setSavedMessage("Saved");
    setTimeout(() => setSavedMessage(null), 1500);
    invalidate();
  }

  function toggleDuration(value: number) {
    const existing = current?.allowedDurations ?? [];
    const next = existing.includes(value) ? existing.filter((d) => d !== value) : [...existing, value];
    setGeneral({ ...(current ?? {}), allowedDurations: next });
  }

  async function saveProjectPermission(projectId: string, patch: Partial<ProjectPermissionView>) {
    await updateProjectPermission(userId, projectId, patch);
    invalidate();
  }

  async function removeProjectPermission(projectId: string) {
    await revokeProjectPermission(userId, projectId);
    invalidate();
  }

  const availableToAdd = projects.filter((p) => !data?.projectPermissions.some((pp) => pp.projectId === p.id));

  if (isLoading || !current) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>General &amp; Social Scheduling</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Toggle
              label="Can request general meetings"
              hint="Lets them submit a request in the General category (not tied to a project)"
              checked={current.canRequestGeneral ?? false}
              onChange={(v) => setGeneral({ ...current, canRequestGeneral: v })}
            />
            <Toggle
              label="Can see general availability"
              hint="Lets them browse your open time slots for General meetings, even before deciding to request one"
              checked={current.canSeeGeneralAvailability ?? false}
              onChange={(v) => setGeneral({ ...current, canSeeGeneralAvailability: v })}
            />
            <Toggle
              label="Can request social meetups"
              hint="Lets them submit a Social-category request (coffee, dinner, etc.) — also requires Social scheduling to be enabled platform-wide in Settings"
              checked={current.canRequestSocial ?? false}
              onChange={(v) => setGeneral({ ...current, canRequestSocial: v })}
            />
            <Toggle
              label="Can see social availability"
              hint="Lets them browse your open time slots for Social meetups"
              checked={current.canSeeSocialAvailability ?? false}
              onChange={(v) => setGeneral({ ...current, canSeeSocialAvailability: v })}
            />
            <Toggle
              label="Can request online meetings"
              hint="Applies to their General/Social requests specifically — project-level online/in-person access is set separately below"
              checked={current.canRequestOnline ?? false}
              onChange={(v) => setGeneral({ ...current, canRequestOnline: v })}
            />
            <Toggle
              label="Can request in-person meetings"
              hint="Applies to their General/Social requests specifically — project-level online/in-person access is set separately below"
              checked={current.canRequestInPerson ?? false}
              onChange={(v) => setGeneral({ ...current, canRequestInPerson: v })}
            />
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              Allowed durations
              <HelpHint text="Leave none selected to let this person use whichever durations are enabled platform-wide in Settings. Select specific ones to restrict them to just those." />
            </p>
            <div className="flex flex-wrap gap-2">
              {durationOptions.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDuration(d)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    (current.allowedDurations ?? []).includes(d)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveGeneral}>
              Save
            </Button>
            {savedMessage && <span className="text-xs text-emerald-600">{savedMessage}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            Project Access
            <HelpHint text="View and request-rights are separate: a collaborator added to a project automatically gets View, but you have to grant Request meeting yourself before they can ask for time on it." />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data?.projectPermissions.length === 0 && (
            <p className="text-sm text-muted-foreground">No project access granted yet.</p>
          )}
          {data?.projectPermissions.map((pp) => (
            <ProjectPermissionRow
              key={pp.projectId}
              perm={pp}
              projectName={projects.find((p) => p.id === pp.projectId)?.name ?? pp.projectId}
              onSave={(patch) => saveProjectPermission(pp.projectId, patch)}
              onRemove={() => removeProjectPermission(pp.projectId)}
            />
          ))}

          {availableToAdd.length > 0 && (
            <div className="flex gap-2 border-t border-border pt-3">
              <Select value={addProjectId} onChange={(e) => setAddProjectId(e.target.value)}>
                <option value="">Grant access to a project...</option>
                {availableToAdd.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                disabled={!addProjectId}
                onClick={async () => {
                  await saveProjectPermission(addProjectId, { canView: true });
                  setAddProjectId("");
                }}
              >
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectPermissionRow({
  perm,
  projectName,
  onSave,
  onRemove,
}: {
  perm: ProjectPermissionView;
  projectName: string;
  onSave: (patch: Partial<ProjectPermissionView>) => void;
  onRemove: () => void;
}) {
  const [local, setLocal] = useState(perm);
  const dirty = JSON.stringify(local) !== JSON.stringify(perm);

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium text-sm">{projectName}</p>
        <button onClick={onRemove} className="text-xs text-muted-foreground underline hover:text-red-600">
          Revoke all access
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Toggle
          label="View"
          hint="They can see this project exists and its basic details — not its private notes"
          checked={local.canView}
          onChange={(v) => setLocal({ ...local, canView: v })}
        />
        <Toggle
          label="Request meeting"
          hint="They can submit a meeting request tied to this project"
          checked={local.canRequestMeeting}
          onChange={(v) => setLocal({ ...local, canRequestMeeting: v })}
        />
        <Toggle label="Online" checked={local.canRequestOnline} onChange={(v) => setLocal({ ...local, canRequestOnline: v })} />
        <Toggle
          label="In person"
          checked={local.canRequestInPerson}
          onChange={(v) => setLocal({ ...local, canRequestInPerson: v })}
        />
      </div>
      {dirty && (
        <Button size="sm" className="mt-2" onClick={() => onSave(local)}>
          Save
        </Button>
      )}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
      {hint && <HelpHint text={hint} />}
    </label>
  );
}
