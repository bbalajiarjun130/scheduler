import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { User } from "../models/User.js";

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
  const login = await request(app).post("/api/auth/login").send({ email, password: "supersecret1" });
  return login.headers["set-cookie"] as string[];
}

describe("settings", () => {
  let adminCookies: string[];

  beforeEach(async () => {
    adminCookies = await signupAndLoginAdmin();
  });

  it("returns sensible defaults on first read", async () => {
    const res = await request(app).get("/api/settings").set("Cookie", adminCookies);
    expect(res.status).toBe(200);
    expect(res.body.bufferMinutes).toBe(10);
    expect(res.body.availableDurations).toEqual([15, 30, 45, 60]);
    expect(res.body.notifyEmailOnMeetingRequest).toBe(true);
  });

  it("admin can update settings and the change persists", async () => {
    const patch = await request(app)
      .patch("/api/settings")
      .set("Cookie", adminCookies)
      .send({ bufferMinutes: 20, availableDurations: [30, 60], socialSchedulingEnabled: false });
    expect(patch.status).toBe(200);
    expect(patch.body.bufferMinutes).toBe(20);

    const reread = await request(app).get("/api/settings").set("Cookie", adminCookies);
    expect(reread.body.bufferMinutes).toBe(20);
    expect(reread.body.availableDurations).toEqual([30, 60]);
    expect(reread.body.socialSchedulingEnabled).toBe(false);
  });

  it("non-admins cannot read or write full settings, but can read the public subset", async () => {
    const userCookies = await signupApprovedUser(adminCookies, "collab@example.com");

    const readFull = await request(app).get("/api/settings").set("Cookie", userCookies);
    expect(readFull.status).toBe(403);

    const write = await request(app).patch("/api/settings").set("Cookie", userCookies).send({ bufferMinutes: 1 });
    expect(write.status).toBe(403);

    const readPublic = await request(app).get("/api/settings/public").set("Cookie", userCookies);
    expect(readPublic.status).toBe(200);
    expect(readPublic.body.availableDurations).toBeDefined();
    // Internal-only fields never reach a non-admin response.
    expect(readPublic.body.notifyEmailOnMeetingRequest).toBeUndefined();
    expect(readPublic.body.reminderMinutesBefore).toBeUndefined();
  });

  it("disabling social scheduling blocks requests even for a user with social permission granted", async () => {
    const userCookies = await signupApprovedUser(adminCookies, "social@example.com");
    const user = await User.findOne({ email: "social@example.com" });
    await request(app)
      .patch(`/api/permissions/users/${user!._id}`)
      .set("Cookie", adminCookies)
      .send({ canRequestSocial: true, canRequestOnline: true });

    await request(app).patch("/api/settings").set("Cookie", adminCookies).send({ socialSchedulingEnabled: false });

    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 10);
    while (start.getUTCDay() === 0 || start.getUTCDay() === 6) start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(15, 0, 0, 0);

    const res = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "social",
      title: "Coffee",
      start: start.toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    expect(res.status).toBe(403);
  });
});
