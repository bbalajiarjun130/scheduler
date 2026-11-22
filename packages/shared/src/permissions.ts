import { z } from "zod";

export const updateProjectPermissionSchema = z.object({
  canView: z.boolean().optional(),
  canRequestMeeting: z.boolean().optional(),
  canRequestOnline: z.boolean().optional(),
  canRequestInPerson: z.boolean().optional(),
  allowedDurations: z.array(z.number().int().positive()).optional(),
});
export type UpdateProjectPermissionInput = z.infer<typeof updateProjectPermissionSchema>;

export const updateUserPermissionsSchema = z.object({
  canRequestGeneral: z.boolean().optional(),
  canSeeGeneralAvailability: z.boolean().optional(),
  canRequestSocial: z.boolean().optional(),
  canSeeSocialAvailability: z.boolean().optional(),
  canRequestOnline: z.boolean().optional(),
  canRequestInPerson: z.boolean().optional(),
  allowedDurations: z.array(z.number().int().positive()).optional(),
});
export type UpdateUserPermissionsInput = z.infer<typeof updateUserPermissionsSchema>;

export interface ProjectPermissionView {
  userId: string;
  projectId: string;
  canView: boolean;
  canRequestMeeting: boolean;
  canRequestOnline: boolean;
  canRequestInPerson: boolean;
  allowedDurations: number[];
}

export interface UserPermissionsView {
  userId: string;
  canRequestGeneral: boolean;
  canSeeGeneralAvailability: boolean;
  canRequestSocial: boolean;
  canSeeSocialAvailability: boolean;
  canRequestOnline: boolean;
  canRequestInPerson: boolean;
  allowedDurations: number[];
}
