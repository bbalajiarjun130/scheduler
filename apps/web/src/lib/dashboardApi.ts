import type { CalendarEventView } from "@scheduler/shared";
import { api } from "./apiClient";

export interface DashboardData {
  today: CalendarEventView[];
  upcomingMeetings: CalendarEventView[];
  upcomingWorkSessions: CalendarEventView[];
  upcomingPersonalSocial: CalendarEventView[];
  pendingMeetingRequests: unknown[];
}

export function fetchDashboard(tz: string) {
  return api.get<DashboardData>(`/dashboard?tz=${encodeURIComponent(tz)}`);
}
