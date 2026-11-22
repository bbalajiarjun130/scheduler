import { api } from "./apiClient";

export interface GoogleIntegrationStatus {
  connected: boolean;
  status: "connected" | "needs_reauth" | "disconnected";
  googleEmail?: string;
  connectedAt?: string;
}

export function fetchGoogleStatus() {
  return api.get<GoogleIntegrationStatus>("/integrations/google/status");
}

export function getGoogleConnectUrl() {
  return api.get<{ url: string }>("/integrations/google/connect").then((r) => r.url);
}

export function disconnectGoogle() {
  return api.post<void>("/integrations/google/disconnect");
}
