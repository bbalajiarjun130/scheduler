import type { CalendarEventView, PublicUser } from "@scheduler/shared";
import type { UserDoc } from "../models/User.js";
import type { ExpandedEvent } from "../services/calendarService.js";

export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as PublicUser["role"],
    status: user.status as PublicUser["status"],
    emailVerified: user.emailVerified,
    timezone: user.timezone,
    createdAt: (user as unknown as { createdAt: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

export function toEventView(event: ExpandedEvent): CalendarEventView {
  return {
    id: event.id,
    masterId: event.masterId,
    type: event.type,
    title: event.title,
    description: event.description,
    isPrivate: event.isPrivate,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    timezone: event.timezone,
    projectId: event.projectId,
    source: event.source,
    googleEventId: event.googleEventId,
    meetUrl: event.meetUrl,
    location: event.location,
    status: event.status,
    isRecurring: event.isRecurring,
    isOverride: event.isOverride,
    createdBy: event.createdBy,
  };
}
