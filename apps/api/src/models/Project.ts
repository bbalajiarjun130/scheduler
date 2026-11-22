import { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, maxlength: 5000 },
    category: { type: String, trim: true, maxlength: 100 },
    color: { type: String, default: "#6366f1" },
    startDate: { type: Date },
    deadline: { type: Date },
    archived: { type: Boolean, default: false },
    collaborators: [{ type: Schema.Types.ObjectId, ref: "User" }],
    notes: { type: String, maxlength: 10000 }, // admin-only; never serialized to non-admins
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export type ProjectDoc = InferSchemaType<typeof projectSchema> & { _id: Types.ObjectId };
export const Project: Model<ProjectDoc> = model<ProjectDoc>("Project", projectSchema);
