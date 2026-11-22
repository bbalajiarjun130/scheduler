import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { env } from "../config/env.js";

/** Ensures a bootstrap admin exists when no users are present yet and seed env vars are set. */
export async function ensureSeedAdmin(): Promise<void> {
  if (!env.ADMIN_SEED_EMAIL || !env.ADMIN_SEED_PASSWORD) return;

  const userCount = await User.countDocuments({});
  if (userCount > 0) return;

  const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 12);
  await User.create({
    name: env.ADMIN_SEED_NAME ?? "Admin",
    email: env.ADMIN_SEED_EMAIL.toLowerCase(),
    passwordHash,
    role: "admin",
    status: "approved",
    emailVerified: true,
  });
  console.log(`Seeded admin account: ${env.ADMIN_SEED_EMAIL}`);
}
