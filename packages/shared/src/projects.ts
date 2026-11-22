import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(5000).optional(),
  category: z.string().trim().max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex code like #4f46e5")
    .optional(),
  startDate: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
  notes: z.string().max(10000).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().trim().max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  startDate: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
  notes: z.string().max(10000).optional(),
  archived: z.boolean().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addCollaboratorSchema = z.object({
  userId: z.string().min(1),
});
export type AddCollaboratorInput = z.infer<typeof addCollaboratorSchema>;

export interface ProjectCollaboratorView {
  id: string;
  name: string;
  email: string;
}

export interface ProjectView {
  id: string;
  name: string;
  description?: string;
  category?: string;
  color: string;
  startDate?: string;
  deadline?: string;
  archived: boolean;
  collaborators: ProjectCollaboratorView[];
  notes?: string;
  totalScheduledHours: number;
  totalCompletedHours: number;
  createdAt: string;
}
