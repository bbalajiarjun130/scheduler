import { connectDb, disconnectDb } from "../src/config/db.js";
import { User } from "../src/models/User.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: tsx scripts/ensureAdmin.ts <email>");
  process.exit(1);
}

await connectDb();

const existing = await User.findOne({ email: email.toLowerCase() });

if (existing) {
  existing.role = "admin";
  existing.status = "approved";
  existing.emailVerified = true;
  await existing.save();
  console.log(`Updated existing user ${email} -> role=admin, status=approved`);
} else {
  await User.create({
    name: email.split("@")[0],
    email: email.toLowerCase(),
    role: "admin",
    status: "approved",
    emailVerified: true,
    // No passwordHash: sign in with Google using this same email, which will
    // link to this account automatically (see POST /api/auth/google).
  });
  console.log(`Created new admin user ${email} (no password set — sign in with Google)`);
}

await disconnectDb();
