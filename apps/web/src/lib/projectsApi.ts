import type { CreateProjectInput, ProjectView, UpdateProjectInput } from "@scheduler/shared";
import { api } from "./apiClient";

export function fetchProjects(includeArchived = false) {
  return api
    .get<{ projects: ProjectView[] }>(`/projects${includeArchived ? "?includeArchived=true" : ""}`)
    .then((r) => r.projects);
}

export function fetchProject(id: string) {
  return api.get<{ project: ProjectView }>(`/projects/${id}`).then((r) => r.project);
}

export function createProject(input: CreateProjectInput) {
  return api.post<{ project: ProjectView }>("/projects", input).then((r) => r.project);
}

export function updateProject(id: string, input: UpdateProjectInput) {
  return api.patch<{ project: ProjectView }>(`/projects/${id}`, input).then((r) => r.project);
}

export function deleteProject(id: string) {
  return api.delete<void>(`/projects/${id}`);
}

export function addCollaborator(projectId: string, userId: string) {
  return api.post<{ project: ProjectView }>(`/projects/${projectId}/collaborators`, { userId }).then((r) => r.project);
}

export function removeCollaborator(projectId: string, userId: string) {
  return api.delete<{ project: ProjectView }>(`/projects/${projectId}/collaborators/${userId}`).then((r) => r.project);
}
