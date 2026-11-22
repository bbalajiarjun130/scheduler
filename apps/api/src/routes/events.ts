import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import rrulePkg from "rrule";
const { rrulestr } = rrulePkg;
import {
  createEventSchema,
  updateEventSchema,
  eventRangeQuerySchema,
} from "@scheduler/shared";
import { CalendarEvent } from "../models/CalendarEvent.js";
import { Project } from "../models/Project.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { listOccurrencesInRange, checkConflict, isValidObjectId, toExpanded } from "../services/calendarService.js";
import { toEventView } from "../utils/serializers.js";
import { recordAudit } from "../services/auditService.js";

export const eventsRouter = Router();

eventsRouter.use(requireAuth, requireRole("admin"));

function assertValidRRule(rule: string) {
  try {
    rrulestr(rule);
  } catch {
    throw ApiError.badRequest("Invalid recurrence rule");
  }
}

async function assertProjectExists(projectId: string) {
  if (!isValidObjectId(projectId)) throw ApiError.badRequest("Invalid projectId");
  const exists = await Project.exists({ _id: projectId });
  if (!exists) throw ApiError.badRequest("Project not found");
}

eventsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { start, end, projectId } = eventRangeQuerySchema.parse(req.query);
    let occurrences = await listOccurrencesInRange(start, end);
    if (projectId) occurrences = occurrences.filter((e) => e.projectId === projectId);
    res.json({ events: occurrences.map(toEventView) });
  })
);

eventsRouter.post(
  "/check-conflict",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      start: z.coerce.date(),
      end: z.coerce.date(),
      excludeMasterId: z.string().optional(),
    });
    const input = schema.parse(req.body);
    const result = await checkConflict(input.start, input.end, { excludeMasterId: input.excludeMasterId });
    res.json({ conflicts: result.conflicts, conflictingEvents: result.conflictingEvents.map(toEventView) });
  })
);

eventsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createEventSchema.parse(req.body);
    if (input.recurrenceRule) assertValidRRule(input.recurrenceRule);
    if (input.end <= input.start) throw ApiError.badRequest("End time must be after start time");
    if (input.projectId) await assertProjectExists(input.projectId);

    if (!input.overrideConflicts) {
      const { conflicts, conflictingEvents } = await checkConflict(input.start, input.end);
      if (conflicts) {
        throw ApiError.conflict("This time conflicts with an existing event", {
          conflictingEvents: conflictingEvents.map(toEventView),
        });
      }
    }

    const event = await CalendarEvent.create({
      type: input.type,
      title: input.title,
      description: input.description,
      isPrivate: input.isPrivate ?? input.type !== "meeting",
      startUtc: input.start,
      endUtc: input.end,
      timezone: input.timezone,
      recurrenceRule: input.recurrenceRule,
      projectId: input.projectId,
      location: input.location,
      createdBy: req.user!._id,
    });

    await recordAudit({ actorId: req.user!._id, action: "event_created", targetType: "CalendarEvent", targetId: event._id });

    const view = toExpanded(event, event.startUtc, event.endUtc, event._id.toString(), false);
    res.status(201).json({ event: toEventView(view) });
  })
);

async function findMasterOr404(id: string) {
  if (!isValidObjectId(id)) throw ApiError.notFound();
  const master = await CalendarEvent.findOne({ _id: id, parentEventId: { $exists: false } });
  if (!master) throw ApiError.notFound();
  return master;
}

eventsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateEventSchema.parse(req.body);
    if (input.projectId) await assertProjectExists(input.projectId);
    const master = await findMasterOr404(req.params.id);

    const isRecurring = Boolean(master.recurrenceRule);
    const scope = input.scope ?? "all";

    if (isRecurring && scope === "instance") {
      if (!input.occurrenceStart) throw ApiError.badRequest("occurrenceStart is required for scope=instance");

      const durationMs = master.endUtc.getTime() - master.startUtc.getTime();
      const newStart = input.start ?? input.occurrenceStart;
      const newEnd = input.end ?? new Date(newStart.getTime() + durationMs);

      if (input.status !== "cancelled" && !input.overrideConflicts) {
        const { conflicts, conflictingEvents } = await checkConflict(newStart, newEnd, {
          excludeMasterId: master._id.toString(),
        });
        if (conflicts) {
          throw ApiError.conflict("This time conflicts with an existing event", {
            conflictingEvents: conflictingEvents.map(toEventView),
          });
        }
      }

      const override = await CalendarEvent.findOneAndUpdate(
        { parentEventId: master._id, originalStartUtc: input.occurrenceStart },
        {
          $setOnInsert: {
            parentEventId: master._id,
            originalStartUtc: input.occurrenceStart,
            type: master.type,
            source: master.source,
            createdBy: master.createdBy,
            projectId: master.projectId,
          },
          $set: {
            title: input.title ?? master.title,
            description: input.description ?? master.description,
            isPrivate: input.isPrivate ?? master.isPrivate,
            location: input.location ?? master.location,
            timezone: input.timezone ?? master.timezone,
            startUtc: newStart,
            endUtc: newEnd,
            status: input.status ?? "confirmed",
            ...(input.completedHours !== undefined ? { completedHours: input.completedHours } : {}),
          },
        },
        { upsert: true, new: true }
      );

      await recordAudit({
        actorId: req.user!._id,
        action: "event_occurrence_updated",
        targetType: "CalendarEvent",
        targetId: master._id,
        metadata: { occurrenceStart: input.occurrenceStart },
      });

      const view = toExpanded(override!, override!.startUtc, override!.endUtc, master._id.toString(), true);
      res.json({ event: toEventView(view) });
      return;
    }

    // scope = "all", or a non-recurring master
    if ((input.start || input.end) && isRecurring) {
      throw ApiError.badRequest("Moving the start/end time of a recurring series is not supported; edit a single occurrence instead");
    }

    if (!isRecurring && (input.start || input.end)) {
      const newStart = input.start ?? master.startUtc;
      const newEnd = input.end ?? master.endUtc;
      if (newEnd <= newStart) throw ApiError.badRequest("End time must be after start time");
      if (input.status !== "cancelled" && !input.overrideConflicts) {
        const { conflicts, conflictingEvents } = await checkConflict(newStart, newEnd, {
          excludeMasterId: master._id.toString(),
        });
        if (conflicts) {
          throw ApiError.conflict("This time conflicts with an existing event", {
            conflictingEvents: conflictingEvents.map(toEventView),
          });
        }
      }
      master.startUtc = newStart;
      master.endUtc = newEnd;
    }

    if (input.title !== undefined) master.title = input.title;
    if (input.description !== undefined) master.description = input.description;
    if (input.isPrivate !== undefined) master.isPrivate = input.isPrivate;
    if (input.location !== undefined) master.location = input.location;
    if (input.timezone !== undefined) master.timezone = input.timezone;
    if (input.status !== undefined) master.status = input.status;
    if (input.completedHours !== undefined) master.completedHours = input.completedHours;
    if (input.projectId !== undefined) master.projectId = new Types.ObjectId(input.projectId);

    await master.save();

    await recordAudit({ actorId: req.user!._id, action: "event_updated", targetType: "CalendarEvent", targetId: master._id });

    const view = toExpanded(master, master.startUtc, master.endUtc, master._id.toString(), false);
    res.json({ event: toEventView(view) });
  })
);

eventsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const scopeSchema = z.object({
      scope: z.enum(["instance", "all"]).default("all"),
      occurrenceStart: z.coerce.date().optional(),
    });
    const { scope, occurrenceStart } = scopeSchema.parse(req.query);
    const master = await findMasterOr404(req.params.id);

    if (master.recurrenceRule && scope === "instance") {
      if (!occurrenceStart) throw ApiError.badRequest("occurrenceStart is required for scope=instance");
      const durationMs = master.endUtc.getTime() - master.startUtc.getTime();
      await CalendarEvent.findOneAndUpdate(
        { parentEventId: master._id, originalStartUtc: occurrenceStart },
        {
          $setOnInsert: {
            parentEventId: master._id,
            originalStartUtc: occurrenceStart,
            type: master.type,
            source: master.source,
            createdBy: master.createdBy,
            title: master.title,
            startUtc: occurrenceStart,
            endUtc: new Date(occurrenceStart.getTime() + durationMs),
            timezone: master.timezone,
          },
          $set: { status: "cancelled" },
        },
        { upsert: true }
      );
    } else {
      await CalendarEvent.deleteMany({ $or: [{ _id: master._id }, { parentEventId: master._id }] });
    }

    await recordAudit({
      actorId: req.user!._id,
      action: "event_deleted",
      targetType: "CalendarEvent",
      targetId: master._id,
      metadata: { scope },
    });

    res.status(204).send();
  })
);
