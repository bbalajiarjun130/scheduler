import { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";

const meetingRequestSchema = new Schema(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, enum: ["project", "general", "social"], required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 5000 },

    durationMinutes: { type: Number, required: true },
    startUtc: { type: Date, required: true },
    endUtc: { type: Date, required: true },
    timezone: { type: String, default: "UTC" },

    format: { type: String, enum: ["online", "in_person"], required: true },
    location: { type: String, maxlength: 300 },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "alternative_proposed", "cancelled", "completed"],
      default: "pending",
      required: true,
    },

    adminNotes: { type: String, maxlength: 5000, select: false },
    rejectionReason: { type: String, maxlength: 1000 },

    alternativeStartUtc: { type: Date },
    alternativeEndUtc: { type: Date },
    alternativeNote: { type: String, maxlength: 1000 },

    resultingEventId: { type: Schema.Types.ObjectId, ref: "CalendarEvent" },

    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

meetingRequestSchema.index({ status: 1, createdAt: -1 });
meetingRequestSchema.index({ requesterId: 1, createdAt: -1 });

export type MeetingRequestDoc = InferSchemaType<typeof meetingRequestSchema> & { _id: Types.ObjectId };
export const MeetingRequest: Model<MeetingRequestDoc> = model<MeetingRequestDoc>(
  "MeetingRequest",
  meetingRequestSchema
);
