import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { signOAuthState, verifyOAuthState } from "../utils/tokens.js";
import {
  getConsentUrl,
  handleOAuthCallback,
  disconnectGoogle,
  getIntegrationStatus,
} from "../services/googleCalendarService.js";
import { recordAudit } from "../services/auditService.js";
import { env } from "../config/env.js";

export const integrationsRouter = Router();

integrationsRouter.get(
  "/google/status",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    res.json(await getIntegrationStatus());
  })
);

integrationsRouter.get(
  "/google/connect",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const state = signOAuthState(req.user!._id.toString());
    res.json({ url: getConsentUrl(state) });
  })
);

// Google redirects the admin's browser here directly (top-level navigation), so this
// responds with a redirect back into the frontend rather than JSON.
integrationsRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const querySchema = z.object({
      code: z.string().optional(),
      state: z.string().optional(),
      error: z.string().optional(),
    });
    const { code, state, error } = querySchema.parse(req.query);

    if (error || !code || !state) {
      res.redirect(`${env.WEB_BASE_URL}/admin/settings?google=error`);
      return;
    }

    try {
      const adminUserId = verifyOAuthState(state);
      await handleOAuthCallback(code, adminUserId);
      await recordAudit({ actorId: adminUserId, action: "google_calendar_connected", targetType: "GoogleIntegration" });
      res.redirect(`${env.WEB_BASE_URL}/admin/settings?google=connected`);
    } catch (err) {
      console.error("[google-oauth-callback]", err);
      res.redirect(`${env.WEB_BASE_URL}/admin/settings?google=error`);
    }
  })
);

integrationsRouter.post(
  "/google/disconnect",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await disconnectGoogle();
    await recordAudit({ actorId: req.user!._id, action: "google_calendar_disconnected", targetType: "GoogleIntegration" });
    res.status(204).send();
  })
);
