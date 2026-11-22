// rrule ships no ESM `exports` map, so under Node's native ESM loader only the
// default (whole CJS module.exports) import is reliable — named imports fail at runtime.
import rrulePkg from "rrule";
const { rrulestr } = rrulePkg;
import { Types } from "mongoose";
import { CalendarEvent, type CalendarEventDoc } from "../models/CalendarEvent.js";
import { getSettings } from "../models/Settings.js";

export interface ExpandedEvent {
  id: string; // `${masterId}:${occurrenceStartIso}` — stable per-occurrence key for the frontend
  masterId: string;
  type: CalendarEventDoc["type"];
  title: string;
  description?: string;
  isPrivate: boolean;
  start: Date;
  end: Date;
  timezone: string;
  projectId?: string;
  source: CalendarEventDoc["source"];
  googleEventId?: string;
  meetUrl?: string;
  location?: string;
  status: CalendarEventDoc["status"];
  isRecurring: boolean;
  isOverride: boolean;
  createdBy: string;
}

export function toExpanded(doc: CalendarEventDoc, start: Date, end: Date, masterId: string, isOverride: boolean): ExpandedEvent {
  return {
    id: `${masterId}:${start.toISOString()}`,
    masterId,
    type: doc.type,
    title: doc.title,
    description: doc.description ?? undefined,
    isPrivate: doc.isPrivate ?? true,
    start,
    end,
    timezone: doc.timezone,
    projectId: doc.projectId?.toString(),
    source: doc.source,
    googleEventId: doc.googleEventId ?? undefined,
    meetUrl: doc.meetUrl ?? undefined,
    location: doc.location ?? undefined,
    status: doc.status,
    isRecurring: Boolean(doc.recurrenceRule) || isOverride,
    isOverride,
    createdBy: doc.createdBy.toString(),
  };
}

/**
 * Expands events (including recurring series) that intersect [rangeStart, rangeEnd).
 *
 * Recurrence math is done on the stored UTC instants via rrule, which is correct for
 * fixed-offset cadences but will drift by the DST delta for rules anchored in a
 * DST-observing zone across a DST boundary. Acceptable for a personal scheduler;
 * revisit with a tz-aware rrule adapter if that ever matters in practice.
 */
export async function listOccurrencesInRange(rangeStart: Date, rangeEnd: Date): Promise<ExpandedEvent[]> {
  const masters = await CalendarEvent.find({
    parentEventId: { $exists: false },
    status: { $ne: "cancelled" },
  });

  const recurringMasterIds = masters.filter((m) => m.recurrenceRule).map((m) => m._id);
  const overrides = recurringMasterIds.length
    ? await CalendarEvent.find({ parentEventId: { $in: recurringMasterIds } })
    : [];

  const overridesByMaster = new Map<string, Map<number, CalendarEventDoc>>();
  for (const o of overrides) {
    const key = o.parentEventId!.toString();
    if (!overridesByMaster.has(key)) overridesByMaster.set(key, new Map());
    overridesByMaster.get(key)!.set(o.originalStartUtc!.getTime(), o);
  }

  const results: ExpandedEvent[] = [];

  for (const master of masters) {
    if (!master.recurrenceRule) {
      if (master.endUtc > rangeStart && master.startUtc < rangeEnd) {
        results.push(toExpanded(master, master.startUtc, master.endUtc, master._id.toString(), false));
      }
      continue;
    }

    const durationMs = master.endUtc.getTime() - master.startUtc.getTime();
    const rule = rrulestr(master.recurrenceRule, { dtstart: master.startUtc });
    const occurrenceStarts = rule.between(
      new Date(rangeStart.getTime() - durationMs),
      rangeEnd,
      true
    );

    const masterOverrides = overridesByMaster.get(master._id.toString()) ?? new Map();

    for (const occStart of occurrenceStarts) {
      const override = masterOverrides.get(occStart.getTime());
      if (override) {
        if (override.status === "cancelled") continue;
        if (override.endUtc > rangeStart && override.startUtc < rangeEnd) {
          results.push(toExpanded(override, override.startUtc, override.endUtc, master._id.toString(), true));
        }
        continue;
      }
      const occEnd = new Date(occStart.getTime() + durationMs);
      if (occEnd > rangeStart && occStart < rangeEnd) {
        results.push(toExpanded(master, occStart, occEnd, master._id.toString(), false));
      }
    }
  }

  return results.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export interface ConflictCheckOptions {
  excludeMasterId?: string;
  bufferMinutesOverride?: number;
}

export interface ConflictResult {
  conflicts: boolean;
  conflictingEvents: ExpandedEvent[];
}

/** Re-validate immediately before committing any approval/booking to close the TOCTOU race window. */
export async function checkConflict(start: Date, end: Date, options: ConflictCheckOptions = {}): Promise<ConflictResult> {
  const settings = await getSettings();
  const bufferMinutes = options.bufferMinutesOverride ?? settings.bufferMinutes;
  const bufferMs = bufferMinutes * 60 * 1000;

  const windowStart = new Date(start.getTime() - bufferMs - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(end.getTime() + bufferMs + 24 * 60 * 60 * 1000);

  const occurrences = await listOccurrencesInRange(windowStart, windowEnd);

  const conflictingEvents = occurrences.filter((occ) => {
    if (occ.status === "cancelled") return false;
    if (options.excludeMasterId && occ.masterId === options.excludeMasterId) return false;
    const occStartBuffered = occ.start.getTime() - bufferMs;
    const occEndBuffered = occ.end.getTime() + bufferMs;
    return start.getTime() < occEndBuffered && end.getTime() > occStartBuffered;
  });

  return { conflicts: conflictingEvents.length > 0, conflictingEvents };
}

export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}
