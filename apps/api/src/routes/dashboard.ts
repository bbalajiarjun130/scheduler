import { Router } from "express";
import { DateTime } from "luxon";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { listOccurrencesInRange } from "../services/calendarService.js";
import { toEventView } from "../utils/serializers.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requireRole("admin"));

dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tz = typeof req.query.tz === "string" ? req.query.tz : "UTC";
    const now = DateTime.now().setZone(tz);
    const todayStart = now.startOf("day").toUTC().toJSDate();
    const todayEnd = now.endOf("day").toUTC().toJSDate();
    const lookaheadEnd = now.plus({ days: 30 }).toUTC().toJSDate();

    const [todayEvents, upcoming] = await Promise.all([
      listOccurrencesInRange(todayStart, todayEnd),
      listOccurrencesInRange(now.toUTC().toJSDate(), lookaheadEnd),
    ]);

    const nonCancelled = upcoming.filter((e) => e.status !== "cancelled");

    res.json({
      today: todayEvents.filter((e) => e.status !== "cancelled").map(toEventView),
      upcomingMeetings: nonCancelled.filter((e) => e.type === "meeting").slice(0, 8).map(toEventView),
      upcomingWorkSessions: nonCancelled.filter((e) => e.type === "work_session").slice(0, 8).map(toEventView),
      upcomingPersonalSocial: nonCancelled
        .filter((e) => e.type === "personal" || e.type === "social")
        .slice(0, 8)
        .map(toEventView),
      // Wired up in later phases once those models exist.
      pendingMeetingRequests: [],
    });
  })
);
