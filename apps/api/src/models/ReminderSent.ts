import { Schema, model, type InferSchemaType, type Model } from "mongoose";

const reminderSentSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "CalendarEvent", required: true, unique: true },
  },
  { timestamps: true }
);

export type ReminderSentDoc = InferSchemaType<typeof reminderSentSchema>;
export const ReminderSent: Model<ReminderSentDoc> = model<ReminderSentDoc>("ReminderSent", reminderSentSchema);
