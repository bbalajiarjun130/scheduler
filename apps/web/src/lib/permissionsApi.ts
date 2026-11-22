import type {
  ProjectPermissionView,
  UpdateProjectPermissionInput,
  UpdateUserPermissionsInput,
  UserPermissionsView,
} from "@scheduler/shared";
import { api } from "./apiClient";

export function fetchUserPermissions(userId: string) {
  return api.get<{ userPermissions: UserPermissionsView; projectPermissions: ProjectPermissionView[] }>(
    `/permissions/users/${userId}`
  );
}

export function updateUserPermissions(userId: string, input: UpdateUserPermissionsInput) {
  return api
    .patch<{ userPermissions: UserPermissionsView }>(`/permissions/users/${userId}`, input)
    .then((r) => r.userPermissions);
}

export function updateProjectPermission(userId: string, projectId: string, input: UpdateProjectPermissionInput) {
  return api
    .patch<{ projectPermission: ProjectPermissionView }>(`/permissions/users/${userId}/projects/${projectId}`, input)
    .then((r) => r.projectPermission);
}

export function revokeProjectPermission(userId: string, projectId: string) {
  return api.delete<void>(`/permissions/users/${userId}/projects/${projectId}`);
}
