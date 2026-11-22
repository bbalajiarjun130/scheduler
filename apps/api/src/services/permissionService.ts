import { Types } from "mongoose";
import { ProjectPermission, type ProjectPermissionDoc } from "../models/ProjectPermission.js";
import { getUserPermissions, defaultUserPermissions } from "../models/UserPermissions.js";
import { getSettings } from "../models/Settings.js";
import { ApiError } from "../utils/ApiError.js";
import type { UserDoc } from "../models/User.js";

const defaultProjectPermission = {
  canView: false,
  canRequestMeeting: false,
  canRequestOnline: false,
  canRequestInPerson: false,
  allowedDurations: [] as number[],
};

export async function getProjectPermission(
  userId: string | Types.ObjectId,
  projectId: string | Types.ObjectId
): Promise<ProjectPermissionDoc | typeof defaultProjectPermission> {
  const doc = await ProjectPermission.findOne({ userId, projectId });
  return doc ?? defaultProjectPermission;
}

/** Project ids a user is allowed to view (empty for admins, meaning "no restriction" — callers should check role separately). */
export async function getViewableProjectIds(userId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
  const perms = await ProjectPermission.find({ userId, canView: true }).select("projectId");
  return perms.map((p) => p.projectId);
}

async function resolveAllowedDurations(explicit: number[]): Promise<number[]> {
  if (explicit.length > 0) return explicit;
  const settings = await getSettings();
  return settings.availableDurations;
}

/**
 * Throws a 403 if `user` isn't allowed to request (or view availability for) the given
 * category/project/format/duration combination. Admins bypass every check. This is the
 * single enforcement point used by both the meeting-request create endpoint and the
 * availability endpoint, so "can see" and "can request" can never drift apart from
 * what's actually enforced.
 */
export async function assertCanScheduleIn(
  user: UserDoc,
  params: {
    category: "project" | "general" | "social";
    projectId?: string;
    format?: "online" | "in_person";
    durationMinutes?: number;
    intent: "view" | "request";
  }
): Promise<void> {
  if (user.role === "admin") return;

  if (params.category === "project") {
    if (!params.projectId) throw ApiError.badRequest("projectId is required for project meetings");
    const perm = await getProjectPermission(user._id, params.projectId);
    if (!perm.canView) throw ApiError.forbidden("You don't have access to this project");
    if (params.intent === "request") {
      if (!perm.canRequestMeeting) throw ApiError.forbidden("You're not permitted to request meetings for this project");
      if (params.format === "online" && !perm.canRequestOnline) {
        throw ApiError.forbidden("Online meetings are not permitted for this project");
      }
      if (params.format === "in_person" && !perm.canRequestInPerson) {
        throw ApiError.forbidden("In-person meetings are not permitted for this project");
      }
      if (params.durationMinutes !== undefined) {
        const allowed = await resolveAllowedDurations(perm.allowedDurations);
        if (!allowed.includes(params.durationMinutes)) {
          throw ApiError.forbidden(`That duration isn't permitted. Allowed: ${allowed.join(", ")} minutes`);
        }
      }
    }
    return;
  }

  if (params.category === "social") {
    const settings = await getSettings();
    if (!settings.socialSchedulingEnabled) throw ApiError.forbidden("Social scheduling is currently disabled");
  }

  const userPerms = await getUserPermissions(user._id);
  const canSee = params.category === "general" ? userPerms.canSeeGeneralAvailability : userPerms.canSeeSocialAvailability;
  const canRequest = params.category === "general" ? userPerms.canRequestGeneral : userPerms.canRequestSocial;

  if (params.intent === "view") {
    if (!canSee && !canRequest) throw ApiError.forbidden(`You don't have access to ${params.category} scheduling`);
    return;
  }

  if (!canRequest) throw ApiError.forbidden(`You're not permitted to request ${params.category} meetings`);
  if (params.format === "online" && !userPerms.canRequestOnline) {
    throw ApiError.forbidden("Online meetings are not permitted for you");
  }
  if (params.format === "in_person" && !userPerms.canRequestInPerson) {
    throw ApiError.forbidden("In-person meetings are not permitted for you");
  }
  if (params.durationMinutes !== undefined) {
    const allowed = await resolveAllowedDurations(userPerms.allowedDurations);
    if (!allowed.includes(params.durationMinutes)) {
      throw ApiError.forbidden(`That duration isn't permitted. Allowed: ${allowed.join(", ")} minutes`);
    }
  }
}

export { defaultUserPermissions };
