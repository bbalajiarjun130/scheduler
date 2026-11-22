import { Router } from "express";
import { updateProjectPermissionSchema, updateUserPermissionsSchema } from "@scheduler/shared";
import { ProjectPermission } from "../models/ProjectPermission.js";
import { UserPermissions, defaultUserPermissions } from "../models/UserPermissions.js";
import { User } from "../models/User.js";
import { Project } from "../models/Project.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { isValidObjectId } from "../services/calendarService.js";
import { toProjectPermissionView, toUserPermissionsView } from "../utils/serializers.js";
import { recordAudit } from "../services/auditService.js";

export const permissionsRouter = Router();

permissionsRouter.use(requireAuth, requireRole("admin"));

permissionsRouter.get(
  "/users/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) throw ApiError.notFound();
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound();

    const userPerms = (await UserPermissions.findOne({ userId })) ?? defaultUserPermissions;
    const projectPerms = await ProjectPermission.find({ userId });

    res.json({
      userPermissions: toUserPermissionsView(userId, userPerms),
      projectPermissions: projectPerms.map((p) =>
        toProjectPermissionView({
          userId,
          projectId: p.projectId.toString(),
          canView: p.canView,
          canRequestMeeting: p.canRequestMeeting,
          canRequestOnline: p.canRequestOnline,
          canRequestInPerson: p.canRequestInPerson,
          allowedDurations: p.allowedDurations,
        })
      ),
    });
  })
);

permissionsRouter.patch(
  "/users/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) throw ApiError.notFound();
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound();

    const input = updateUserPermissionsSchema.parse(req.body);
    const updated = await UserPermissions.findOneAndUpdate(
      { userId },
      { $set: input, $setOnInsert: { userId } },
      { upsert: true, new: true }
    );

    await recordAudit({
      actorId: req.user!._id,
      action: "user_permissions_updated",
      targetType: "User",
      targetId: user._id,
      metadata: input,
    });

    res.json({ userPermissions: toUserPermissionsView(userId, updated!) });
  })
);

permissionsRouter.patch(
  "/users/:userId/projects/:projectId",
  asyncHandler(async (req, res) => {
    const { userId, projectId } = req.params;
    if (!isValidObjectId(userId) || !isValidObjectId(projectId)) throw ApiError.notFound();
    const [user, project] = await Promise.all([User.findById(userId), Project.findById(projectId)]);
    if (!user) throw ApiError.badRequest("User not found");
    if (!project) throw ApiError.badRequest("Project not found");

    const input = updateProjectPermissionSchema.parse(req.body);
    const updated = await ProjectPermission.findOneAndUpdate(
      { userId, projectId },
      { $set: input, $setOnInsert: { userId, projectId } },
      { upsert: true, new: true }
    );

    await recordAudit({
      actorId: req.user!._id,
      action: "project_permission_updated",
      targetType: "Project",
      targetId: project._id,
      metadata: { userId, ...input },
    });

    res.json({
      projectPermission: toProjectPermissionView({
        userId,
        projectId,
        canView: updated!.canView,
        canRequestMeeting: updated!.canRequestMeeting,
        canRequestOnline: updated!.canRequestOnline,
        canRequestInPerson: updated!.canRequestInPerson,
        allowedDurations: updated!.allowedDurations,
      }),
    });
  })
);

permissionsRouter.delete(
  "/users/:userId/projects/:projectId",
  asyncHandler(async (req, res) => {
    const { userId, projectId } = req.params;
    await ProjectPermission.deleteOne({ userId, projectId });
    await recordAudit({
      actorId: req.user!._id,
      action: "project_permission_revoked",
      targetType: "Project",
      targetId: projectId,
      metadata: { userId },
    });
    res.status(204).send();
  })
);
