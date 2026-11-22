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
  return { cookies: login.headers["set-cookie"] as string[], id: user!._id.toString() };
}

describe("notifications", () => {
  let adminCookies: string[];

  beforeEach(async () => {
    adminCookies = await signupAndLoginAdmin();
  });

  it("notifies the admin in-app when a new user registers, and it's unread", async () => {
    await signupApprovedUser(adminCookies, "collab@example.com");

    const list = await request(app).get("/api/notifications").set("Cookie", adminCookies);
    expect(list.status).toBe(200);
    expect(list.body.notifications.some((n: { type: string }) => n.type === "user_registered")).toBe(true);

    const unread = await request(app).get("/api/notifications/unread-count").set("Cookie", adminCookies);
    expect(unread.body.count).toBeGreaterThan(0);
  });

  it("marking a notification read updates its status and the unread count", async () => {
    await signupApprovedUser(adminCookies, "collab2@example.com");
    const list = await request(app).get("/api/notifications").set("Cookie", adminCookies);
    const notificationId = list.body.notifications[0].id;

    const before = await request(app).get("/api/notifications/unread-count").set("Cookie", adminCookies);

    const markRead = await request(app).post(`/api/notifications/${notificationId}/read`).set("Cookie", adminCookies);
    expect(markRead.status).toBe(200);
    expect(markRead.body.notification.read).toBe(true);

    const after = await request(app).get("/api/notifications/unread-count").set("Cookie", adminCookies);
    expect(after.body.count).toBe(before.body.count - 1);
  });

  it("mark-all-read clears the unread count", async () => {
    await signupApprovedUser(adminCookies, "collab3@example.com");
    await signupApprovedUser(adminCookies, "collab4@example.com");

    await request(app).post("/api/notifications/read-all").set("Cookie", adminCookies);
    const after = await request(app).get("/api/notifications/unread-count").set("Cookie", adminCookies);
    expect(after.body.count).toBe(0);
  });

  it("a user cannot mark another user's notification as read", async () => {
    await signupApprovedUser(adminCookies, "collab5@example.com");
    const { cookies: otherCookies } = await signupApprovedUser(adminCookies, "collab6@example.com");

    const adminList = await request(app).get("/api/notifications").set("Cookie", adminCookies);
    const adminNotificationId = adminList.body.notifications[0].id;

    const res = await request(app).post(`/api/notifications/${adminNotificationId}/read`).set("Cookie", otherCookies);
    expect(res.status).toBe(404);
  });

  it("users only ever see their own notifications", async () => {
    const { cookies: userCookies } = await signupApprovedUser(adminCookies, "collab7@example.com");
    const list = await request(app).get("/api/notifications").set("Cookie", userCookies);
    expect(list.status).toBe(200);
    // The new-registration notification went to the admin, not this user.
    expect(list.body.notifications.some((n: { type: string }) => n.type === "user_registered")).toBe(false);
  });
});
