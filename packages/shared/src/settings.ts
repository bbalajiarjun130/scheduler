import { z } from "zod";

export const updateSettingsSchema = z.object({
  defaultTimezone: z.string().min(1).optional(),
  workingDays: z.array(z.number().int().min(0).max(6)).optional(),
  workingHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  workingHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  bufferMinutes: z.number().int().min(0).max(240).optional(),
  minNoticeHours: z.number().int().min(0).max(24 * 30).optional(),
  maxAdvanceDays: z.number().int().min(1).max(730).optional(),
  availableDurations: z.array(z.number().int().positive()).min(1).optional(),
  defaultMeetingFormat: z.enum(["online", "in_person"]).optional(),
  socialSchedulingEnabled: z.boolean().optional(),
  notifyEmailOnNewRegistration: z.boolean().optional(),
  notifyEmailOnMeetingRequest: z.boolean().optional(),
  reminderMinutesBefore: z.number().int().min(0).max(1440).optional(),
  defaultCalendarView: z.enum(["dayGridMonth", "timeGridWeek", "timeGridDay"]).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export interface SettingsView {
  defaultTimezone: string;
  workingDays: number[];
  workingHoursStart: string;
  workingHoursEnd: string;
  bufferMinutes: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  availableDurations: number[];
  defaultMeetingFormat: "online" | "in_person";
  socialSchedulingEnabled: boolean;
  notifyEmailOnNewRegistration: boolean;
  notifyEmailOnMeetingRequest: boolean;
  reminderMinutesBefore: number;
  defaultCalendarView: "dayGridMonth" | "timeGridWeek" | "timeGridDay";
}

/** The subset any approved user may read — scheduling constraints, no notification/internal config. */
export interface PublicSettingsView {
  defaultTimezone: string;
  workingDays: number[];
  workingHoursStart: string;
  workingHoursEnd: string;
  minNoticeHours: number;
  maxAdvanceDays: number;
  availableDurations: number[];
  defaultMeetingFormat: "online" | "in_person";
  socialSchedulingEnabled: boolean;
}
