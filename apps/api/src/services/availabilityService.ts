import { DateTime } from "luxon";
import { getSettings } from "../models/Settings.js";
import { listOccurrencesInRange } from "./calendarService.js";

export interface Slot {
  start: Date;
  end: Date;
}

const MAX_RANGE_DAYS = 31;
const GRID_MINUTES = 30;

/**
 * Finds open slots of `durationMinutes` within working hours, respecting the buffer
 * between events, minimum booking notice, and maximum advance window from Settings.
 * Candidates are tried on a 30-minute grid for a reasonable number of options without
 * enumerating every minute.
 */
export async function getAvailableSlots(rangeStart: Date, rangeEnd: Date, durationMinutes: number): Promise<Slot[]> {
  const settings = await getSettings();
  const tz = settings.defaultTimezone;
  const bufferMs = settings.bufferMinutes * 60 * 1000;

  const now = DateTime.now();
  const earliestAllowed = now.plus({ hours: settings.minNoticeHours });
  const latestAllowed = now.plus({ days: settings.maxAdvanceDays });

  let windowStart = DateTime.fromJSDate(rangeStart, { zone: tz });
  let windowEnd = DateTime.fromJSDate(rangeEnd, { zone: tz });
  if (windowEnd.diff(windowStart, "days").days > MAX_RANGE_DAYS) {
    windowEnd = windowStart.plus({ days: MAX_RANGE_DAYS });
  }
  if (windowStart < earliestAllowed) windowStart = earliestAllowed;
  if (windowEnd > latestAllowed) windowEnd = latestAllowed;
  if (windowEnd <= windowStart) return [];

  const busy = await listOccurrencesInRange(windowStart.toUTC().toJSDate(), windowEnd.toUTC().toJSDate());
  const busyIntervals = busy
    .filter((b) => b.status !== "cancelled")
    .map((b) => ({ start: b.start.getTime() - bufferMs, end: b.end.getTime() + bufferMs }));

  function overlapsBusy(start: number, end: number): boolean {
    return busyIntervals.some((b) => start < b.end && end > b.start);
  }

  const slots: Slot[] = [];
  let day = windowStart.startOf("day");
  const lastDay = windowEnd.startOf("day");

  while (day <= lastDay) {
    if (settings.workingDays.includes(day.weekday % 7)) {
      const [startH, startM] = settings.workingHoursStart.split(":").map(Number);
      const [endH, endM] = settings.workingHoursEnd.split(":").map(Number);
      let candidate = day.set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
      const dayEnd = day.set({ hour: endH, minute: endM, second: 0, millisecond: 0 });

      while (candidate.plus({ minutes: durationMinutes }) <= dayEnd) {
        const slotEnd = candidate.plus({ minutes: durationMinutes });
        if (candidate >= windowStart && slotEnd <= windowEnd && candidate >= earliestAllowed) {
          const startMs = candidate.toUTC().toMillis();
          const endMs = slotEnd.toUTC().toMillis();
          if (!overlapsBusy(startMs, endMs)) {
            slots.push({ start: candidate.toUTC().toJSDate(), end: slotEnd.toUTC().toJSDate() });
          }
        }
        candidate = candidate.plus({ minutes: GRID_MINUTES });
      }
    }
    day = day.plus({ days: 1 });
  }

  return slots;
}
