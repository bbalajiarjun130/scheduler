import { CalendarEvent } from "../models/CalendarEvent.js";
import { MeetingRequest } from "../models/MeetingRequest.js";
import { ReminderSent } from "../models/ReminderSent.js";
import { User } from "../models/User.js";
import { getSettings } from "../models/Settings.js";
import { notifyUser } from "./notificationService.js";
import { emailProvider } from "./email/index.js";

function meetingReminderTemplate(name: string, title: string, start: Date, minutesUntil: number) {
  const when = start.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  return {
    subject: `Starting soon: ${title}`,
    html: `<p>Hi ${name},</p><p>"${title}" starts in about ${minutesUntil} minutes, at ${when} UTC.</p>`,
    text: `Hi ${name}, "${title}" starts in about ${minutesUntil} minutes, at ${when} UTC.`,
  };
}

/**
 * Finds confirmed, approved meetings starting within the configured reminder window
 * that haven't been reminded yet, and notifies the requester. Meetings created via the
 * approval flow are always single (non-recurring) CalendarEvent docs, so the event's
 * own _id is a stable, unique key for idempotency (tracked in ReminderSent).
 */
export async function sendDueReminders(now: Date = new Date()): Promise<number> {
  const settings = await getSettings();
  const windowEnd = new Date(now.getTime() + settings.reminderMinutesBefore * 60 * 1000);

  const dueEvents = await CalendarEvent.find({
    type: "meeting",
    source: "meeting_approval",
    status: "confirmed",
    startUtc: { $gte: now, $lte: windowEnd },
  });

  let sent = 0;

  for (const event of dueEvents) {
    try {
      await ReminderSent.create({ eventId: event._id });
    } catch {
      continue; // unique index violation: already reminded
    }

    const meetingRequest = await MeetingRequest.findOne({ resultingEventId: event._id });
    if (!meetingRequest) continue;

    const requester = await User.findById(meetingRequest.requesterId);
    if (!requester) continue;

    const minutesUntil = Math.max(1, Math.round((event.startUtc.getTime() - now.getTime()) / 60000));

    await notifyUser({
      userId: requester._id,
      type: "meeting_reminder",
      message: `"${event.title}" starts in about ${minutesUntil} minutes`,
    });
    await emailProvider.send({
      to: requester.email,
      ...meetingReminderTemplate(requester.name, event.title, event.startUtc, minutesUntil),
    });
    sent += 1;
  }

  return sent;
}
