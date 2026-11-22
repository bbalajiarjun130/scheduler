import { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";

const calendarEventSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["meeting", "work_session", "personal", "social", "blocked"],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 5000 },
    isPrivate: { type: Boolean, default: true },

    startUtc: { type: Date, required: true },
    endUtc: { type: Date, required: true },
    timezone: { type: String, required: true, default: "UTC" },

    recurrenceRule: { type: String },
    parentEventId: { type: Schema.Types.ObjectId, ref: "CalendarEvent" },
    originalStartUtc: { type: Date },

    projectId: { type: Schema.Types.ObjectId, ref: "Project" },

    source: {
      type: String,
      enum: ["manual", "meeting_approval", "google_sync"],
      default: "manual",
    },
    googleEventId: { type: String },
    meetUrl: { type: String },
    location: { type: String },

    status: { type: String, enum: ["confirmed", "completed", "cancelled"], default: "confirmed" },

    completedHours: { type: Number },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

calendarEventSchema.index({ startUtc: 1, endUtc: 1 });
calendarEventSchema.index({ parentEventId: 1 });
calendarEventSchema.index({ projectId: 1 });

export type CalendarEventDoc = InferSchemaType<typeof calendarEventSchema> & { _id: Types.ObjectId };
export const CalendarEvent: Model<CalendarEventDoc> = model<CalendarEventDoc>("CalendarEvent", calendarEventSchema);
