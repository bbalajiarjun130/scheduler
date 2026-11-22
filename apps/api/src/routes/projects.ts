import { Router } from "express";
import { createProjectSchema, updateProjectSchema, addCollaboratorSchema } from "@scheduler/shared";
import { Project } from "../models/Project.js";
import { CalendarEvent } from "../models/CalendarEvent.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { toProjectView } from "../utils/serializers.js";
import { getProjectHours } from "../services/projectHoursService.js";
import { recordAudit } from "../services/auditService.js";
import { isValidObjectId } from "../services/calendarService.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth, requireRole("admin"));

async function loadProjectWithView(id: string) {
  const project = await Project.findById(id).populate<{
    collaborators: Array<{ _id: unknown; name: string; email: string }>;
  }>("collaborators", "name email");
  if (!project) throw ApiError.notFound();
  const hours = await getProjectHours(project._id.toString());
  return toProjectView(project as never, hours);
}

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeArchived = req.query.includeArchived === "true";
    const projects = await Project.find(includeArchived ? {} : { archived: false })
      .populate<{ collaborators: Array<{ _id: unknown; name: string; email: string }> }>("collaborators", "name email")
      .sort({ createdAt: -1 });

    const views = await Promise.all(
      projects.map(async (p) => toProjectView(p as never, await getProjectHours(p._id.toString())))
    );
    res.json({ projects: views });
  })
);

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw ApiError.notFound();
    res.json({ project: await loadProjectWithView(req.params.id) });
  })
);

projectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createProjectSchema.parse(req.body);
    const project = await Project.create({ ...input, createdBy: req.user!._id });
    await recordAudit({ actorId: req.user!._id, action: "project_created", targetType: "Project", targetId: project._id });
    res.status(201).json({ project: await loadProjectWithView(project._id.toString()) });
  })
);

projectsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw ApiError.notFound();
    const input = updateProjectSchema.parse(req.body);
    const project = await Project.findById(req.params.id);
    if (!project) throw ApiError.notFound();

    Object.assign(project, input);
    await project.save();

    await recordAudit({ actorId: req.user!._id, action: "project_updated", targetType: "Project", targetId: project._id });
    res.json({ project: await loadProjectWithView(project._id.toString()) });
  })
);

projectsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw ApiError.notFound();
    const project = await Project.findById(req.params.id);
    if (!project) throw ApiError.notFound();

    // Detach rather than cascade-delete, so calendar history survives project deletion.
    await CalendarEvent.updateMany({ projectId: project._id }, { $unset: { projectId: "" } });
    await project.deleteOne();

    await recordAudit({ actorId: req.user!._id, action: "project_deleted", targetType: "Project", targetId: project._id });
    res.status(204).send();
  })
);

projectsRouter.post(
  "/:id/collaborators",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw ApiError.notFound();
    const { userId } = addCollaboratorSchema.parse(req.body);
    if (!isValidObjectId(userId)) throw ApiError.badRequest("Invalid userId");

    const [project, user] = await Promise.all([Project.findById(req.params.id), User.findById(userId)]);
    if (!project) throw ApiError.notFound();
    if (!user) throw ApiError.badRequest("User not found");

    if (!project.collaborators.some((c) => c.toString() === userId)) {
      project.collaborators.push(user._id);
      await project.save();
    }

    await recordAudit({
      actorId: req.user!._id,
      action: "project_collaborator_added",
      targetType: "Project",
      targetId: project._id,
      metadata: { userId },
    });

    res.json({ project: await loadProjectWithView(project._id.toString()) });
  })
);

projectsRouter.delete(
  "/:id/collaborators/:userId",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw ApiError.notFound();
    const project = await Project.findById(req.params.id);
    if (!project) throw ApiError.notFound();

    project.collaborators = project.collaborators.filter((c) => c.toString() !== req.params.userId) as never;
    await project.save();

    await recordAudit({
      actorId: req.user!._id,
      action: "project_collaborator_removed",
      targetType: "Project",
      targetId: project._id,
      metadata: { userId: req.params.userId },
    });

    res.json({ project: await loadProjectWithView(project._id.toString()) });
  })
);
