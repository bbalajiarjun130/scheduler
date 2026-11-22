import { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "user"], default: "user", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended", "deactivated"],
      default: "pending",
      required: true,
    },
    timezone: { type: String, default: "UTC" },

    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyTokenExpires: { type: Date, select: false },

    passwordResetTokenHash: { type: String, select: false },
    passwordResetTokenExpires: { type: Date, select: false },

    refreshTokenVersion: { type: Number, default: 0 },

    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId; id: string };
export const User: Model<UserDoc> = model<UserDoc>("User", userSchema);
