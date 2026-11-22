import { Router } from "express";
import { DateTime } from "luxon";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { listOccurrencesInRange } from "../services/calendarService.js";
import { toEventView, toMeetingRequestView } from "../utils/serializers.js";
import { MeetingRequest } from "../models/MeetingRequest.js";
import { Types } from "mongoose";

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

    const pending = await MeetingRequest.find({ status: { $in: ["pending", "alternative_proposed"] } })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate<{ requesterId: { _id: Types.ObjectId; name: string; email: string } }>("requesterId", "name email");
    const pendingMeetingRequests = pending.map((r) => toMeetingRequestView(r as never, r.requesterId as never, { isAdmin: true }));

    res.json({
      today: todayEvents.filter((e) => e.status !== "cancelled").map(toEventView),
      upcomingMeetings: nonCancelled.filter((e) => e.type === "meeting").slice(0, 8).map(toEventView),
      upcomingWorkSessions: nonCancelled.filter((e) => e.type === "work_session").slice(0, 8).map(toEventView),
      upcomingPersonalSocial: nonCancelled
        .filter((e) => e.type === "personal" || e.type === "social")
        .slice(0, 8)
        .map(toEventView),
      pendingMeetingRequests,
    });
  })
);
