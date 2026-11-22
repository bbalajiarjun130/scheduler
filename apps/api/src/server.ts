import { env, isTest } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { createApp } from "./app.js";
import { ensureSeedAdmin } from "./utils/seedAdmin.js";
import { sendDueReminders } from "./services/reminderService.js";

const REMINDER_CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function main() {
  await connectDb();
  await ensureSeedAdmin();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  if (!isTest) {
    const runReminders = () => sendDueReminders().catch((err) => console.error("[reminders]", err));
    runReminders();
    setInterval(runReminders, REMINDER_CHECK_INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
