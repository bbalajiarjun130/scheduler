import type { CalendarEventView, ProjectView, PublicUser } from "@scheduler/shared";
import type { UserDoc } from "../models/User.js";
import type { ProjectDoc } from "../models/Project.js";
import type { ExpandedEvent } from "../services/calendarService.js";
import type { ProjectHours } from "../services/projectHoursService.js";

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

export function toProjectView(
  project: Omit<ProjectDoc, "collaborators"> & {
    collaborators: Array<{ _id: { toString(): string }; name: string; email: string }>;
  },
  hours: ProjectHours
): ProjectView {
  return {
    id: project._id.toString(),
    name: project.name,
    description: project.description ?? undefined,
    category: project.category ?? undefined,
    color: project.color,
    startDate: project.startDate?.toISOString(),
    deadline: project.deadline?.toISOString(),
    archived: project.archived,
    collaborators: project.collaborators.map((c) => ({ id: c._id.toString(), name: c.name, email: c.email })),
    notes: project.notes ?? undefined,
    totalScheduledHours: hours.totalScheduledHours,
    totalCompletedHours: hours.totalCompletedHours,
    createdAt: (project as unknown as { createdAt: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
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
    completedHours: event.completedHours,
  };
}
