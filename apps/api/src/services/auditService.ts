import type { Types } from "mongoose";
import { AuditLog } from "../models/AuditLog.js";

export async function recordAudit(params: {
  actorId: Types.ObjectId | string;
  action: string;
  targetType: string;
  targetId?: Types.ObjectId | string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await AuditLog.create({
    actorId: params.actorId,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    metadata: params.metadata,
  });
}
