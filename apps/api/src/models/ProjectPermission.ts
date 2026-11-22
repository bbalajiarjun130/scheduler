import { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";

const projectPermissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },

    canView: { type: Boolean, default: true },
    canRequestMeeting: { type: Boolean, default: false },
    canRequestOnline: { type: Boolean, default: false },
    canRequestInPerson: { type: Boolean, default: false },
    // Empty = fall back to the global Settings.availableDurations list; non-empty = restrict to this subset.
    allowedDurations: { type: [Number], default: [] },
  },
  { timestamps: true }
);

projectPermissionSchema.index({ userId: 1, projectId: 1 }, { unique: true });

export type ProjectPermissionDoc = InferSchemaType<typeof projectPermissionSchema> & { _id: Types.ObjectId };
export const ProjectPermission: Model<ProjectPermissionDoc> = model<ProjectPermissionDoc>(
  "ProjectPermission",
  projectPermissionSchema
);
