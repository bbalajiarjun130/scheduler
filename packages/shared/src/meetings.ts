import { z } from "zod";
import { eventFormatSchema } from "./calendar.js";

export const meetingCategorySchema = z.enum(["project", "general", "social"]);
export const meetingStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "alternative_proposed",
  "cancelled",
  "completed",
]);

export const createMeetingRequestSchema = z.object({
  category: meetingCategorySchema,
  projectId: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  start: z.coerce.date(),
  durationMinutes: z.number().int().positive().max(480),
  format: eventFormatSchema,
  location: z.string().max(300).optional(),
});
export type CreateMeetingRequestInput = z.infer<typeof createMeetingRequestSchema>;

export const approveMeetingRequestSchema = z.object({
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  format: eventFormatSchema.optional(),
  location: z.string().max(300).optional(),
  adminNotes: z.string().max(5000).optional(),
  overrideConflicts: z.boolean().optional(),
});
export type ApproveMeetingRequestInput = z.infer<typeof approveMeetingRequestSchema>;

export const rejectMeetingRequestSchema = z.object({
  reason: z.string().max(1000).optional(),
});
export type RejectMeetingRequestInput = z.infer<typeof rejectMeetingRequestSchema>;

export const proposeAlternativeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  note: z.string().max(1000).optional(),
});
export type ProposeAlternativeInput = z.infer<typeof proposeAlternativeSchema>;

export const adminNotesSchema = z.object({
  adminNotes: z.string().max(5000),
});
export type AdminNotesInput = z.infer<typeof adminNotesSchema>;

export const availabilityQuerySchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  durationMinutes: z.coerce.number().int().positive().max(480),
  category: meetingCategorySchema,
  projectId: z.string().optional(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export interface AvailableSlot {
  start: string;
  end: string;
}

export interface MeetingRequestView {
  id: string;
  requester: { id: string; name: string; email: string };
  category: z.infer<typeof meetingCategorySchema>;
  projectId?: string;
  projectName?: string;
  title: string;
  description?: string;
  durationMinutes: number;
  start: string;
  end: string;
  format: "online" | "in_person";
  location?: string;
  status: z.infer<typeof meetingStatusSchema>;
  adminNotes?: string;
  alternativeStart?: string;
  alternativeEnd?: string;
  alternativeNote?: string;
  resultingEventId?: string;
  meetUrl?: string;
  createdAt: string;
}
