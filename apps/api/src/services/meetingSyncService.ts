import { MeetingRequest } from "../models/MeetingRequest.js";
import { User } from "../models/User.js";
import { notifyUser } from "./notificationService.js";
import { emailProvider } from "./email/index.js";
import { meetingCancelledTemplate, meetingRescheduledTemplate } from "./email/templates.js";

/**
 * Keeps a MeetingRequest in sync when its linked CalendarEvent is edited directly
 * from the calendar (rather than through the meeting-request approval endpoints),
 * and notifies the requester — covers "when rescheduled/cancelled, notify attendees".
 */
export async function syncMeetingRequestFromEventChange(
  eventId: string,
  change: { cancelled?: boolean; completed?: boolean; newStart?: Date; newEnd?: Date }
): Promise<void> {
  const request = await MeetingRequest.findOne({ resultingEventId: eventId });
  if (!request) return;

  const requester = await User.findById(request.requesterId);

  if (change.cancelled) {
    request.status = "cancelled";
    await request.save();
    if (requester) {
      await notifyUser({ userId: request.requesterId, type: "meeting_cancelled", message: `Your meeting "${request.title}" was cancelled` });
      await emailProvider.send({ to: requester.email, ...meetingCancelledTemplate(requester.name, request.title) });
    }
    return;
  }

  if (change.completed) {
    request.status = "completed";
    await request.save();
    return;
  }

  if (change.newStart && change.newEnd) {
    request.startUtc = change.newStart;
    request.endUtc = change.newEnd;
    await request.save();
    if (requester) {
      await notifyUser({ userId: request.requesterId, type: "meeting_rescheduled", message: `Your meeting "${request.title}" was rescheduled` });
      await emailProvider.send({ to: requester.email, ...meetingRescheduledTemplate(requester.name, request.title, change.newStart) });
    }
  }
}
