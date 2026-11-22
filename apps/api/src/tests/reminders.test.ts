import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { sendDueReminders } from "../services/reminderService.js";

const app = createApp();

async function signupAndLoginAdmin() {
  await request(app).post("/api/auth/signup").send({
    name: "Admin User",
    email: "admin@example.com",
    password: "supersecret1",
  });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@example.com", password: "supersecret1" });
  return login.headers["set-cookie"] as string[];
}

async function signupApprovedUser(adminCookies: string[], email: string) {
  await request(app).post("/api/auth/signup").send({ name: "Test User", email, password: "supersecret1" });
  const user = await User.findOne({ email });
  await request(app).post(`/api/users/${user!._id}/approve`).set("Cookie", adminCookies);
  const { UserPermissions } = await import("../models/UserPermissions.js");
  await UserPermissions.create({ userId: user!._id, canRequestGeneral: true, canRequestOnline: true });
  const login = await request(app).post("/api/auth/login").send({ email, password: "supersecret1" });
  return { cookies: login.headers["set-cookie"] as string[], id: user!._id.toString() };
}

describe("meeting reminders", () => {
  let adminCookies: string[];

  beforeEach(async () => {
    adminCookies = await signupAndLoginAdmin();
  });

  it("sends a reminder for an approved meeting starting within the reminder window, and only once", async () => {
    const { cookies: userCookies, id: userId } = await signupApprovedUser(adminCookies, "collab@example.com");

    const soon = new Date(Date.now() + 25 * 60 * 60 * 1000); // > 24h min notice
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Reminder test",
      start: soon.toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    await request(app).post(`/api/meeting-requests/${created.body.request.id}/approve`).set("Cookie", adminCookies).send({});

    // Simulate "now" being inside the default 30-minute reminder window before the meeting.
    const justBefore = new Date(soon.getTime() - 20 * 60 * 1000);
    const sentCount = await sendDueReminders(justBefore);
    expect(sentCount).toBe(1);

    const notifications = await Notification.find({ userId, type: "meeting_reminder" });
    expect(notifications).toHaveLength(1);

    // Running it again for the same "now" must not double-send.
    const secondRun = await sendDueReminders(justBefore);
    expect(secondRun).toBe(0);
    const stillOne = await Notification.find({ userId, type: "meeting_reminder" });
    expect(stillOne).toHaveLength(1);
  });

  it("does not send a reminder for a meeting outside the reminder window", async () => {
    const { cookies: userCookies, id: userId } = await signupApprovedUser(adminCookies, "collab2@example.com");

    const farOut = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Far out meeting",
      start: farOut.toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    await request(app).post(`/api/meeting-requests/${created.body.request.id}/approve`).set("Cookie", adminCookies).send({});

    const sentCount = await sendDueReminders(new Date());
    expect(sentCount).toBe(0);
    const notifications = await Notification.find({ userId, type: "meeting_reminder" });
    expect(notifications).toHaveLength(0);
  });

  it("does not remind for a cancelled meeting", async () => {
    const { cookies: userCookies, id: userId } = await signupApprovedUser(adminCookies, "collab3@example.com");

    const soon = new Date(Date.now() + 25 * 60 * 60 * 1000);
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Cancelled meeting",
      start: soon.toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    const approved = await request(app)
      .post(`/api/meeting-requests/${created.body.request.id}/approve`)
      .set("Cookie", adminCookies)
      .send({});
    await request(app).post(`/api/meeting-requests/${created.body.request.id}/cancel`).set("Cookie", adminCookies);

    const justBefore = new Date(soon.getTime() - 20 * 60 * 1000);
    const sentCount = await sendDueReminders(justBefore);
    expect(sentCount).toBe(0);
    const notifications = await Notification.find({ userId, type: "meeting_reminder" });
    expect(notifications).toHaveLength(0);
    void approved;
  });
});
