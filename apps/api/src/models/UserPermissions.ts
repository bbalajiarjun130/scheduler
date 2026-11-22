import { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";

const userPermissionsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    canRequestGeneral: { type: Boolean, default: false },
    canSeeGeneralAvailability: { type: Boolean, default: false },

    canRequestSocial: { type: Boolean, default: false },
    canSeeSocialAvailability: { type: Boolean, default: false },

    canRequestOnline: { type: Boolean, default: false },
    canRequestInPerson: { type: Boolean, default: false },
    // Empty = fall back to the global Settings.availableDurations list; non-empty = restrict to this subset.
    allowedDurations: { type: [Number], default: [] },
  },
  { timestamps: true }
);

export type UserPermissionsDoc = InferSchemaType<typeof userPermissionsSchema> & { _id: Types.ObjectId };
export const UserPermissions: Model<UserPermissionsDoc> = model<UserPermissionsDoc>(
  "UserPermissions",
  userPermissionsSchema
);

export const defaultUserPermissions = {
  canRequestGeneral: false,
  canSeeGeneralAvailability: false,
  canRequestSocial: false,
  canSeeSocialAvailability: false,
  canRequestOnline: false,
  canRequestInPerson: false,
  allowedDurations: [] as number[],
};

export async function getUserPermissions(userId: string | Types.ObjectId): Promise<UserPermissionsDoc | typeof defaultUserPermissions> {
  const doc = await UserPermissions.findOne({ userId });
  return doc ?? defaultUserPermissions;
}
