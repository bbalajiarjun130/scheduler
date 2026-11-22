import { Schema, model, type InferSchemaType, type Model } from "mongoose";

const googleIntegrationSchema = new Schema(
  {
    singletonKey: { type: String, default: "default", unique: true },

    status: { type: String, enum: ["connected", "needs_reauth", "disconnected"], default: "disconnected" },
    connectedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    googleEmail: { type: String },
    scopes: { type: [String], default: [] },
    encryptedRefreshToken: { type: String, select: false },
    connectedAt: { type: Date },
  },
  { timestamps: true }
);

export type GoogleIntegrationDoc = InferSchemaType<typeof googleIntegrationSchema>;
export const GoogleIntegration: Model<GoogleIntegrationDoc> = model<GoogleIntegrationDoc>(
  "GoogleIntegration",
  googleIntegrationSchema
);

export async function getGoogleIntegration() {
  return GoogleIntegration.findOne({ singletonKey: "default" }).select("+encryptedRefreshToken");
}
