import { Router } from "express";
import { updateSettingsSchema } from "@scheduler/shared";
import { Settings, getSettings } from "../models/Settings.js";
import { requireAuth, requireRole, requireApproved } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { toSettingsView, toPublicSettingsView } from "../utils/serializers.js";
import { recordAudit } from "../services/auditService.js";

export const settingsRouter = Router();

settingsRouter.get(
  "/public",
  requireAuth,
  requireApproved,
  asyncHandler(async (_req, res) => {
    res.json(toPublicSettingsView(await getSettings()));
  })
);

settingsRouter.use(requireAuth, requireRole("admin"));

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(toSettingsView(await getSettings()));
  })
);

settingsRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const input = updateSettingsSchema.parse(req.body);
    await getSettings(); // ensure the singleton exists
    const updated = await Settings.findOneAndUpdate({ singletonKey: "default" }, { $set: input }, { new: true });

    await recordAudit({ actorId: req.user!._id, action: "settings_updated", targetType: "Settings", metadata: input });

    res.json(toSettingsView(updated!));
  })
);
