import type {
  ApproveMeetingRequestInput,
  AvailableSlot,
  CreateMeetingRequestInput,
  MeetingCategory,
  MeetingRequestView,
  ProposeAlternativeInput,
} from "@scheduler/shared";
import { api } from "./apiClient";

export function fetchMyRequests() {
  return api.get<{ requests: MeetingRequestView[] }>("/meeting-requests/mine").then((r) => r.requests);
}

export function fetchAllRequests(status?: string) {
  return api
    .get<{ requests: MeetingRequestView[] }>(`/meeting-requests${status ? `?status=${status}` : ""}`)
    .then((r) => r.requests);
}

export function fetchAvailability(
  start: Date,
  end: Date,
  durationMinutes: number,
  category: MeetingCategory,
  projectId?: string
) {
  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
    durationMinutes: String(durationMinutes),
    category,
  });
  if (projectId) params.set("projectId", projectId);
  return api.get<{ slots: AvailableSlot[] }>(`/meeting-requests/availability?${params}`).then((r) => r.slots);
}

export function createMeetingRequest(input: CreateMeetingRequestInput) {
  return api.post<{ request: MeetingRequestView }>("/meeting-requests", input).then((r) => r.request);
}

export function cancelMeetingRequest(id: string) {
  return api.post<{ request: MeetingRequestView }>(`/meeting-requests/${id}/cancel`).then((r) => r.request);
}

export function acceptAlternative(id: string) {
  return api.post<{ request: MeetingRequestView }>(`/meeting-requests/${id}/accept-alternative`).then((r) => r.request);
}

export function declineAlternative(id: string) {
  return api.post<{ request: MeetingRequestView }>(`/meeting-requests/${id}/decline-alternative`).then((r) => r.request);
}

export function approveMeetingRequest(id: string, input: ApproveMeetingRequestInput) {
  return api.post<{ request: MeetingRequestView }>(`/meeting-requests/${id}/approve`, input).then((r) => r.request);
}

export function rejectMeetingRequest(id: string, reason?: string) {
  return api.post<{ request: MeetingRequestView }>(`/meeting-requests/${id}/reject`, { reason }).then((r) => r.request);
}

export function proposeAlternative(id: string, input: ProposeAlternativeInput) {
  return api
    .post<{ request: MeetingRequestView }>(`/meeting-requests/${id}/propose-alternative`, input)
    .then((r) => r.request);
}

export function setAdminNotes(id: string, adminNotes: string) {
  return api.patch<{ request: MeetingRequestView }>(`/meeting-requests/${id}/notes`, { adminNotes }).then((r) => r.request);
}
