import type { CalendarEventView, CreateEventInput, UpdateEventInput } from "@scheduler/shared";
import { api } from "./apiClient";

export function fetchEvents(start: Date, end: Date) {
  const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
  return api.get<{ events: CalendarEventView[] }>(`/events?${params.toString()}`).then((r) => r.events);
}

export function createEvent(input: CreateEventInput) {
  return api.post<{ event: CalendarEventView }>("/events", input).then((r) => r.event);
}

export function updateEvent(masterId: string, input: UpdateEventInput) {
  return api.patch<{ event: CalendarEventView }>(`/events/${masterId}`, input).then((r) => r.event);
}

export function deleteEvent(masterId: string, opts?: { scope?: "instance" | "all"; occurrenceStart?: string }) {
  const params = new URLSearchParams();
  if (opts?.scope) params.set("scope", opts.scope);
  if (opts?.occurrenceStart) params.set("occurrenceStart", opts.occurrenceStart);
  const qs = params.toString();
  return api.delete<void>(`/events/${masterId}${qs ? `?${qs}` : ""}`);
}

export function checkConflict(start: Date, end: Date, excludeMasterId?: string) {
  return api.post<{ conflicts: boolean; conflictingEvents: CalendarEventView[] }>("/events/check-conflict", {
    start: start.toISOString(),
    end: end.toISOString(),
    excludeMasterId,
  });
}

export function parseOccurrenceId(id: string): { masterId: string; occurrenceStart: string } {
  const idx = id.indexOf(":");
  return { masterId: id.slice(0, idx), occurrenceStart: id.slice(idx + 1) };
}
