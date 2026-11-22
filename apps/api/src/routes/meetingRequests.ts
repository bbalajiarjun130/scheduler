import { Router } from "express";
import { Types } from "mongoose";
import {
  createMeetingRequestSchema,
  approveMeetingRequestSchema,
  rejectMeetingRequestSchema,
  proposeAlternativeSchema,
  adminNotesSchema,
  availabilityQuerySchema,
} from "@scheduler/shared";
import { MeetingRequest, type MeetingRequestDoc } from "../models/MeetingRequest.js";
import { Project } from "../models/Project.js";
import { CalendarEvent } from "../models/CalendarEvent.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth, requireRole, requireApproved } from "../middleware/auth.js";
import { checkConflict, isValidObjectId } from "../services/calendarService.js";
import { getAvailableSlots } from "../services/availabilityService.js";
import { getSettings } from "../models/Settings.js";
import { toMeetingRequestView, toEventView } from "../utils/serializers.js";
import { recordAudit } from "../services/auditService.js";
import { notifyUser, notifyAllAdmins, getAdmins } from "../services/notificationService.js";
import { emailProvider } from "../services/email/index.js";
import {
  meetingApprovedTemplate,
  meetingRejectedTemplate,
  meetingAlternativeProposedTemplate,
  meetingCancelledTemplate,
  newMeetingRequestAdminTemplate,
} from "../services/email/templates.js";

export const meetingRequestsRouter = Router();

meetingRequestsRouter.use(requireAuth, requireApproved);

async function loadView(doc: MeetingRequestDoc | null, isAdmin: boolean) {
  if (!doc) throw ApiError.notFound();
  const populated = await MeetingRequest.findById(doc._id)
    .populate<{ requesterId: { _id: Types.ObjectId; name: string; email: string } }>("requesterId", "name email")
    .select(isAdmin ? "+adminNotes" : "");
  if (!populated) throw ApiError.notFound();
  const projectName = populated.projectId
    ? (await Project.findById(populated.projectId).select("name"))?.name
    : undefined;
  return toMeetingRequestView(populated as never, populated.requesterId as never, { isAdmin, projectName });
}

meetingRequestsRouter.get(
  "/availability",
  asyncHandler(async (req, res) => {
    const { start, end, durationMinutes } = availabilityQuerySchema.parse(req.query);
    const slots = await getAvailableSlots(start, end, durationMinutes);
    res.json({ slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })) });
  })
);

meetingRequestsRouter.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const requests = await MeetingRequest.find({ requesterId: req.user!._id }).sort({ createdAt: -1 });
    const views = await Promise.all(requests.map((r) => loadView(r, false)));
    res.json({ requests: views });
  })
);

meetingRequestsRouter.get(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const requests = await MeetingRequest.find(status ? { status } : {}).sort({ createdAt: -1 });
    const views = await Promise.all(requests.map((r) => loadView(r, true)));
    res.json({ requests: views });
  })
);

meetingRequestsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createMeetingRequestSchema.parse(req.body);

    if (input.category === "project" && !input.projectId) {
      throw ApiError.badRequest("projectId is required for project meetings");
    }
    if (input.projectId) {
      const project = await Project.findById(input.projectId);
      if (!project) throw ApiError.badRequest("Project not found");
    }

    const settings = await getSettings();
    const end = new Date(input.start.getTime() + input.durationMinutes * 60 * 1000);
    const minStart = new Date(Date.now() + settings.minNoticeHours * 60 * 60 * 1000);
    const maxStart = new Date(Date.now() + settings.maxAdvanceDays * 24 * 60 * 60 * 1000);
    if (input.start < minStart) {
      throw ApiError.badRequest(`Meetings must be requested at least ${settings.minNoticeHours} hours in advance`);
    }
    if (input.start > maxStart) {
      throw ApiError.badRequest(`Meetings cannot be requested more than ${settings.maxAdvanceDays} days in advance`);
    }

    const request = await MeetingRequest.create({
      requesterId: req.user!._id,
      category: input.category,
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      durationMinutes: input.durationMinutes,
      startUtc: input.start,
      endUtc: end,
      format: input.format,
      location: input.location,
    });

    const admins = await getAdmins();
    await notifyAllAdmins({
      type: "meeting_requested",
      message: `${req.user!.name} requested a meeting: "${input.title}"`,
      link: "/requests",
    });
    for (const admin of admins) {
      await emailProvider.send({
        to: admin.email,
        ...newMeetingRequestAdminTemplate(req.user!.name, input.title, input.start),
      });
    }

    await recordAudit({
      actorId: req.user!._id,
      action: "meeting_requested",
      targetType: "MeetingRequest",
      targetId: request._id,
    });

    res.status(201).json({ request: await loadView(request, false) });
  })
);

async function findOwnedOr404(id: string, userId: Types.ObjectId, isAdmin: boolean) {
  if (!isValidObjectId(id)) throw ApiError.notFound();
  const request = await MeetingRequest.findById(id);
  if (!request) throw ApiError.notFound();
  if (!isAdmin && request.requesterId.toString() !== userId.toString()) throw ApiError.forbidden();
  return request;
}

// --- Requester actions ---

meetingRequestsRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const request = await findOwnedOr404(req.params.id, req.user!._id, req.user!.role === "admin");
    if (!["pending", "approved", "alternative_proposed"].includes(request.status)) {
      throw ApiError.badRequest("This request can no longer be cancelled");
    }

    request.status = "cancelled";
    request.cancelledBy = req.user!._id;
    await request.save();

    if (request.resultingEventId) {
      await CalendarEvent.findByIdAndUpdate(request.resultingEventId, { status: "cancelled" });
    }

    const isRequester = request.requesterId.toString() === req.user!._id.toString();
    if (isRequester) {
      await notifyAllAdmins({
        type: "meeting_cancelled_by_user",
        message: `${req.user!.name} cancelled the meeting "${request.title}"`,
        link: "/admin/requests",
      });
    } else {
      await notifyUser({
        userId: request.requesterId,
        type: "meeting_cancelled",
        message: `Your meeting "${request.title}" was cancelled`,
      });
      const requester = await User.findById(request.requesterId);
      if (requester) {
        await emailProvider.send({ to: requester.email, ...meetingCancelledTemplate(requester.name, request.title) });
      }
    }

    await recordAudit({ actorId: req.user!._id, action: "meeting_cancelled", targetType: "MeetingRequest", targetId: request._id });
    res.json({ request: await loadView(request, req.user!.role === "admin") });
  })
);

meetingRequestsRouter.post(
  "/:id/accept-alternative",
  asyncHandler(async (req, res) => {
    const request = await findOwnedOr404(req.params.id, req.user!._id, false);
    if (request.status !== "alternative_proposed" || !request.alternativeStartUtc || !request.alternativeEndUtc) {
      throw ApiError.badRequest("No alternative time is pending for this request");
    }

    const { conflicts, conflictingEvents } = await checkConflict(request.alternativeStartUtc, request.alternativeEndUtc);
    if (conflicts) {
      throw ApiError.conflict("That time is no longer available", {
        conflictingEvents: conflictingEvents.map(toEventView),
      });
    }

    const event = await CalendarEvent.create({
      type: "meeting",
      title: request.title,
      description: request.description,
      isPrivate: false,
      startUtc: request.alternativeStartUtc,
      endUtc: request.alternativeEndUtc,
      timezone: request.timezone ?? "UTC",
      projectId: request.projectId,
      source: "meeting_approval",
      location: request.format === "in_person" ? request.location : undefined,
      status: "confirmed",
      createdBy: req.user!._id,
    });

    request.status = "approved";
    request.startUtc = request.alternativeStartUtc;
    request.endUtc = request.alternativeEndUtc;
    request.resultingEventId = event._id;
    await request.save();

    await notifyAllAdmins({
      type: "meeting_alternative_accepted",
      message: `${req.user!.name} accepted the proposed time for "${request.title}"`,
      link: "/admin/requests",
    });

    await recordAudit({ actorId: req.user!._id, action: "meeting_alternative_accepted", targetType: "MeetingRequest", targetId: request._id });
    res.json({ request: await loadView(request, false) });
  })
);

meetingRequestsRouter.post(
  "/:id/decline-alternative",
  asyncHandler(async (req, res) => {
    const request = await findOwnedOr404(req.params.id, req.user!._id, false);
    if (request.status !== "alternative_proposed") {
      throw ApiError.badRequest("No alternative time is pending for this request");
    }
    request.status = "cancelled";
    request.cancelledBy = req.user!._id;
    await request.save();

    await notifyAllAdmins({
      type: "meeting_alternative_declined",
      message: `${req.user!.name} declined the proposed time for "${request.title}"`,
      link: "/admin/requests",
    });

    await recordAudit({ actorId: req.user!._id, action: "meeting_alternative_declined", targetType: "MeetingRequest", targetId: request._id });
    res.json({ request: await loadView(request, false) });
  })
);

// --- Admin actions ---

meetingRequestsRouter.patch(
  "/:id/notes",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { adminNotes } = adminNotesSchema.parse(req.body);
    const request = await MeetingRequest.findById(req.params.id);
    if (!request) throw ApiError.notFound();
    request.adminNotes = adminNotes;
    await request.save();
    res.json({ request: await loadView(request, true) });
  })
);

meetingRequestsRouter.post(
  "/:id/approve",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const input = approveMeetingRequestSchema.parse(req.body);
    const request = await MeetingRequest.findById(req.params.id);
    if (!request) throw ApiError.notFound();
    if (!["pending", "alternative_proposed"].includes(request.status)) {
      throw ApiError.badRequest("This request is not awaiting approval");
    }

    const start = input.start ?? request.startUtc;
    const end = input.end ?? request.endUtc;
    const format = input.format ?? request.format;
    const location = input.location ?? request.location;

    if (!input.overrideConflicts) {
      const { conflicts, conflictingEvents } = await checkConflict(start, end);
      if (conflicts) {
        throw ApiError.conflict("This time conflicts with an existing event", {
          conflictingEvents: conflictingEvents.map(toEventView),
        });
      }
    }

    const event = await CalendarEvent.create({
      type: "meeting",
      title: request.title,
      description: request.description,
      isPrivate: false,
      startUtc: start,
      endUtc: end,
      timezone: request.timezone ?? "UTC",
      projectId: request.projectId,
      source: "meeting_approval",
      location: format === "in_person" ? location : undefined,
      status: "confirmed",
      createdBy: req.user!._id,
    });

    request.status = "approved";
    request.startUtc = start;
    request.endUtc = end;
    request.format = format;
    request.location = location;
    request.resultingEventId = event._id;
    if (input.adminNotes !== undefined) request.adminNotes = input.adminNotes;
    await request.save();

    const requester = await User.findById(request.requesterId);
    await notifyUser({ userId: request.requesterId, type: "meeting_approved", message: `Your meeting "${request.title}" was approved` });
    if (requester) {
      await emailProvider.send({
        to: requester.email,
        ...meetingApprovedTemplate(requester.name, request.title, start, event.meetUrl ?? undefined, event.location ?? undefined),
      });
    }

    await recordAudit({ actorId: req.user!._id, action: "meeting_approved", targetType: "MeetingRequest", targetId: request._id });
    res.json({ request: await loadView(request, true) });
  })
);

meetingRequestsRouter.post(
  "/:id/reject",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { reason } = rejectMeetingRequestSchema.parse(req.body);
    const request = await MeetingRequest.findById(req.params.id);
    if (!request) throw ApiError.notFound();
    if (!["pending", "alternative_proposed"].includes(request.status)) {
      throw ApiError.badRequest("This request is not awaiting a decision");
    }

    request.status = "rejected";
    request.rejectionReason = reason;
    await request.save();

    const requester = await User.findById(request.requesterId);
    await notifyUser({ userId: request.requesterId, type: "meeting_rejected", message: `Your meeting "${request.title}" was declined` });
    if (requester) {
      await emailProvider.send({ to: requester.email, ...meetingRejectedTemplate(requester.name, request.title, reason) });
    }

    await recordAudit({ actorId: req.user!._id, action: "meeting_rejected", targetType: "MeetingRequest", targetId: request._id, metadata: { reason } });
    res.json({ request: await loadView(request, true) });
  })
);

meetingRequestsRouter.post(
  "/:id/propose-alternative",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const input = proposeAlternativeSchema.parse(req.body);
    const request = await MeetingRequest.findById(req.params.id);
    if (!request) throw ApiError.notFound();
    if (!["pending", "alternative_proposed"].includes(request.status)) {
      throw ApiError.badRequest("This request is not awaiting a decision");
    }

    request.status = "alternative_proposed";
    request.alternativeStartUtc = input.start;
    request.alternativeEndUtc = input.end;
    request.alternativeNote = input.note;
    await request.save();

    const requester = await User.findById(request.requesterId);
    await notifyUser({
      userId: request.requesterId,
      type: "meeting_alternative_proposed",
      message: `A new time was proposed for "${request.title}"`,
    });
    if (requester) {
      await emailProvider.send({
        to: requester.email,
        ...meetingAlternativeProposedTemplate(requester.name, request.title, input.start, input.note),
      });
    }

    await recordAudit({ actorId: req.user!._id, action: "meeting_alternative_proposed", targetType: "MeetingRequest", targetId: request._id });
    res.json({ request: await loadView(request, true) });
  })
);
