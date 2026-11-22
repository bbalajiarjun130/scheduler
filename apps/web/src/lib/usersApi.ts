import type { PublicUser, UserStatus } from "@scheduler/shared";
import { api } from "./apiClient";

export function fetchUsers(status?: UserStatus) {
  return api.get<{ users: PublicUser[] }>(`/users${status ? `?status=${status}` : ""}`).then((r) => r.users);
}
