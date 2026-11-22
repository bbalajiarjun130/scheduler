import { z } from "zod";

export const eventTypeSchema = z.enum(["meeting", "work_session", "personal", "social", "blocked"]);
export const eventFormatSchema = z.enum(["online", "in_person"]);

export const createEventSchema = z.object({
  type: eventTypeSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  isPrivate: z.boolean().optional(),
  start: z.coerce.date(),
  end: z.coerce.date(),
  timezone: z.string().min(1),
  recurrenceRule: z.string().max(500).optional(),
  projectId: z.string().optional(),
  location: z.string().max(300).optional(),
  overrideConflicts: z.boolean().optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  isPrivate: z.boolean().optional(),
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  timezone: z.string().min(1).optional(),
  location: z.string().max(300).optional(),
  status: z.enum(["confirmed", "completed", "cancelled"]).optional(),
  completedHours: z.number().min(0).max(1000).optional(),
  projectId: z.string().optional(),
  overrideConflicts: z.boolean().optional(),
  scope: z.enum(["instance", "all"]).optional(), // for recurring events: this occurrence only, or the whole series
  occurrenceStart: z.coerce.date().optional(), // required when scope=instance
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const eventRangeQuerySchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  projectId: z.string().optional(),
});
export type EventRangeQuery = z.infer<typeof eventRangeQuerySchema>;

export interface CalendarEventView {
  id: string;
  masterId: string;
  type: z.infer<typeof eventTypeSchema>;
  title: string;
  description?: string;
  isPrivate: boolean;
  start: string;
  end: string;
  timezone: string;
  projectId?: string;
  source: "manual" | "meeting_approval" | "google_sync";
  googleEventId?: string;
  meetUrl?: string;
  location?: string;
  status: "confirmed" | "completed" | "cancelled";
  isRecurring: boolean;
  isOverride: boolean;
  createdBy: string;
  completedHours?: number;
}
