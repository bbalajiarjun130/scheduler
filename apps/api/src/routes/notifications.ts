import { Router } from "express";
import { Notification } from "../models/Notification.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { isValidObjectId } from "../services/calendarService.js";
import { toNotificationView } from "../utils/serializers.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unreadOnly === "true";
    const filter = { userId: req.user!._id, ...(unreadOnly ? { read: false } : {}) };
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json({ notifications: notifications.map(toNotificationView) });
  })
);

notificationsRouter.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments({ userId: req.user!._id, read: false });
    res.json({ count });
  })
);

notificationsRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw ApiError.notFound();
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!._id },
      { read: true },
      { new: true }
    );
    if (!notification) throw ApiError.notFound();
    res.json({ notification: toNotificationView(notification) });
  })
);

notificationsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ userId: req.user!._id, read: false }, { read: true });
    res.status(204).send();
  })
);
