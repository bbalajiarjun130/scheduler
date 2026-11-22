import type { PublicSettingsView, SettingsView, UpdateSettingsInput } from "@scheduler/shared";
import { api } from "./apiClient";

export function fetchSettings() {
  return api.get<SettingsView>("/settings");
}

export function fetchPublicSettings() {
  return api.get<PublicSettingsView>("/settings/public");
}

export function updateSettings(input: UpdateSettingsInput) {
  return api.patch<SettingsView>("/settings", input);
}
