import type {
  CalendarEventView,
  MeetingRequestView,
  ProjectPermissionView,
  ProjectView,
  PublicUser,
  UserPermissionsView,
} from "@scheduler/shared";
import type { UserDoc } from "../models/User.js";
import type { ProjectDoc } from "../models/Project.js";
import type { MeetingRequestDoc } from "../models/MeetingRequest.js";
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
  hours: ProjectHours,
  isAdmin: boolean
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
    // Private admin notes never reach a non-admin response, regardless of what the caller passes in.
    notes: isAdmin ? project.notes ?? undefined : undefined,
    totalScheduledHours: hours.totalScheduledHours,
    totalCompletedHours: hours.totalCompletedHours,
    createdAt: (project as unknown as { createdAt: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

export function toProjectPermissionView(params: {
  userId: string;
  projectId: string;
  canView: boolean;
  canRequestMeeting: boolean;
  canRequestOnline: boolean;
  canRequestInPerson: boolean;
  allowedDurations: number[];
}): ProjectPermissionView {
  return { ...params };
}

export function toUserPermissionsView(userId: string, perms: {
  canRequestGeneral: boolean;
  canSeeGeneralAvailability: boolean;
  canRequestSocial: boolean;
  canSeeSocialAvailability: boolean;
  canRequestOnline: boolean;
  canRequestInPerson: boolean;
  allowedDurations: number[];
}): UserPermissionsView {
  // Explicit field access rather than a spread: `perms` may be a Mongoose document,
  // whose schema fields live behind getters and don't come along with `{...doc}`.
  return {
    userId,
    canRequestGeneral: perms.canRequestGeneral,
    canSeeGeneralAvailability: perms.canSeeGeneralAvailability,
    canRequestSocial: perms.canRequestSocial,
    canSeeSocialAvailability: perms.canSeeSocialAvailability,
    canRequestOnline: perms.canRequestOnline,
    canRequestInPerson: perms.canRequestInPerson,
    allowedDurations: perms.allowedDurations,
  };
}

export function toMeetingRequestView(
  req: MeetingRequestDoc & { adminNotes?: string | null },
  requester: { _id: { toString(): string }; name: string; email: string },
  opts: { isAdmin: boolean; projectName?: string; meetUrl?: string }
): MeetingRequestView {
  return {
    id: req._id.toString(),
    requester: { id: requester._id.toString(), name: requester.name, email: requester.email },
    category: req.category as MeetingRequestView["category"],
    projectId: req.projectId?.toString(),
    projectName: opts.projectName,
    title: req.title,
    description: req.description ?? undefined,
    durationMinutes: req.durationMinutes,
    start: req.startUtc.toISOString(),
    end: req.endUtc.toISOString(),
    format: req.format as MeetingRequestView["format"],
    location: req.location ?? undefined,
    status: req.status as MeetingRequestView["status"],
    adminNotes: opts.isAdmin ? req.adminNotes ?? undefined : undefined,
    alternativeStart: req.alternativeStartUtc?.toISOString(),
    alternativeEnd: req.alternativeEndUtc?.toISOString(),
    alternativeNote: req.alternativeNote ?? undefined,
    resultingEventId: req.resultingEventId?.toString(),
    meetUrl: opts.meetUrl,
    createdAt: (req as unknown as { createdAt: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
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
