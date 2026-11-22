import { Schema, model, type InferSchemaType, type Model } from "mongoose";

const settingsSchema = new Schema(
  {
    singletonKey: { type: String, default: "default", unique: true },

    defaultTimezone: { type: String, default: "UTC" },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] }, // 0=Sun..6=Sat
    workingHoursStart: { type: String, default: "09:00" }, // HH:mm, in defaultTimezone
    workingHoursEnd: { type: String, default: "18:00" },

    bufferMinutes: { type: Number, default: 10 },
    minNoticeHours: { type: Number, default: 24 },
    maxAdvanceDays: { type: Number, default: 60 },

    availableDurations: { type: [Number], default: [15, 30, 45, 60] },
    defaultMeetingFormat: { type: String, enum: ["online", "in_person"], default: "online" },
    socialSchedulingEnabled: { type: Boolean, default: true },

    notifyEmailOnNewRegistration: { type: Boolean, default: true },
    notifyEmailOnMeetingRequest: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema>;
export const Settings: Model<SettingsDoc> = model<SettingsDoc>("Settings", settingsSchema);

export async function getSettings(): Promise<SettingsDoc> {
  const existing = await Settings.findOne({ singletonKey: "default" });
  if (existing) return existing;
  return Settings.create({ singletonKey: "default" });
}
