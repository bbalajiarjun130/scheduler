import type { PublicUser } from "@scheduler/shared";
import type { UserDoc } from "../models/User.js";

export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as PublicUser["role"],
    status: user.status as PublicUser["status"],
    emailVerified: user.emailVerified,
    timezone: user.timezone,
    createdAt: (user as unknown as { createdAt: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
  };
}
