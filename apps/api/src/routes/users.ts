import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { toPublicUser } from "../utils/serializers.js";
import { recordAudit } from "../services/auditService.js";
import { notifyUser } from "../services/notificationService.js";
import { emailProvider } from "../services/email/index.js";
import { accountApprovedTemplate, accountRejectedTemplate } from "../services/email/templates.js";
import { env } from "../config/env.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// --- Admin: list / review users ---

const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "suspended", "deactivated"]).optional(),
});

usersRouter.get(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { status } = listQuerySchema.parse(req.query);
    const filter = status ? { status } : {};
    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json({ users: users.map(toPublicUser) });
  })
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "admin" && req.user!.id !== req.params.id) {
      throw ApiError.forbidden();
    }
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound();
    res.json({ user: toPublicUser(user) });
  })
);

const rejectSchema = z.object({ reason: z.string().max(500).optional() });

usersRouter.post(
  "/:id/approve",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound();
    if (user.status !== "pending") throw ApiError.badRequest("User is not pending approval");

    user.status = "approved";
    user.approvedBy = req.user!._id;
    user.approvedAt = new Date();
    await user.save();

    await recordAudit({ actorId: req.user!._id, action: "user_approved", targetType: "User", targetId: user._id });
    await notifyUser({ userId: user._id, type: "account_approved", message: "Your account has been approved." });

    const tpl = accountApprovedTemplate(user.name, `${env.WEB_BASE_URL}/login`);
    await emailProvider.send({ to: user.email, ...tpl });

    res.json({ user: toPublicUser(user) });
  })
);

usersRouter.post(
  "/:id/reject",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { reason } = rejectSchema.parse(req.body ?? {});
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound();
    if (user.status !== "pending") throw ApiError.badRequest("User is not pending approval");

    user.status = "rejected";
    user.rejectionReason = reason;
    await user.save();

    await recordAudit({
      actorId: req.user!._id,
      action: "user_rejected",
      targetType: "User",
      targetId: user._id,
      metadata: { reason },
    });
    await notifyUser({ userId: user._id, type: "account_rejected", message: "Your registration was not approved." });

    const tpl = accountRejectedTemplate(user.name, reason);
    await emailProvider.send({ to: user.email, ...tpl });

    res.json({ user: toPublicUser(user) });
  })
);

function transitionHandler(nextStatus: "suspended" | "deactivated" | "approved", action: string) {
  return asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound();
    if (user.role === "admin") throw ApiError.badRequest("Cannot change status of an administrator");

    user.status = nextStatus;
    user.refreshTokenVersion += 1;
    await user.save();

    await recordAudit({ actorId: req.user!._id, action, targetType: "User", targetId: user._id });
    res.json({ user: toPublicUser(user) });
  });
}

usersRouter.post("/:id/suspend", requireRole("admin"), transitionHandler("suspended", "user_suspended"));
usersRouter.post("/:id/deactivate", requireRole("admin"), transitionHandler("deactivated", "user_deactivated"));
usersRouter.post("/:id/reactivate", requireRole("admin"), transitionHandler("approved", "user_reactivated"));
