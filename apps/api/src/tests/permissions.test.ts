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
  return login.headers["set-cookie"];
}

async function signupApprovedUser(adminCookies: string[], email: string) {
  await request(app).post("/api/auth/signup").send({ name: "Test User", email, password: "supersecret1" });
  const user = await User.findOne({ email });
  await request(app).post(`/api/users/${user!._id}/approve`).set("Cookie", adminCookies);
  const login = await request(app).post("/api/auth/login").send({ email, password: "supersecret1" });
  return { cookies: login.headers["set-cookie"] as string[], id: user!._id.toString() };
}

function farFutureWeekday(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 10);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(15, 0, 0, 0);
  return d;
}

describe("granular permissions", () => {
  let adminCookies: string[];

  beforeEach(async () => {
    adminCookies = await signupAndLoginAdmin();
  });

  it("denies a general meeting request by default (deny-by-default posture)", async () => {
    const { cookies } = await signupApprovedUser(adminCookies, "nopriv@example.com");
    const res = await request(app).post("/api/meeting-requests").set("Cookie", cookies).send({
      category: "general",
      title: "Chat",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    expect(res.status).toBe(403);
  });

  it("denies browsing general availability without canSeeGeneralAvailability", async () => {
    const { cookies } = await signupApprovedUser(adminCookies, "nopriv2@example.com");
    const start = farFutureWeekday();
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const res = await request(app)
      .get("/api/meeting-requests/availability")
      .query({ start: start.toISOString(), end: end.toISOString(), durationMinutes: 30, category: "general" })
      .set("Cookie", cookies);
    expect(res.status).toBe(403);
  });

  it("grants general access via PATCH /api/permissions/users/:id and the user can then request", async () => {
    const { cookies, id } = await signupApprovedUser(adminCookies, "granted@example.com");

    const grant = await request(app)
      .patch(`/api/permissions/users/${id}`)
      .set("Cookie", adminCookies)
      .send({ canRequestGeneral: true, canSeeGeneralAvailability: true, canRequestOnline: true, allowedDurations: [30] });
    expect(grant.status).toBe(200);
    expect(grant.body.userPermissions.canRequestGeneral).toBe(true);

    const res = await request(app).post("/api/meeting-requests").set("Cookie", cookies).send({
      category: "general",
      title: "Chat",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    expect(res.status).toBe(201);
  });

  it("rejects a format the user isn't permitted to use, and a duration outside their allow-list", async () => {
    const { cookies, id } = await signupApprovedUser(adminCookies, "formatcheck@example.com");
    await request(app)
      .patch(`/api/permissions/users/${id}`)
      .set("Cookie", adminCookies)
      .send({ canRequestGeneral: true, canRequestOnline: true, canRequestInPerson: false, allowedDurations: [30] });

    const wrongFormat = await request(app).post("/api/meeting-requests").set("Cookie", cookies).send({
      category: "general",
      title: "Chat",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "in_person",
    });
    expect(wrongFormat.status).toBe(403);

    const wrongDuration = await request(app).post("/api/meeting-requests").set("Cookie", cookies).send({
      category: "general",
      title: "Chat",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 90,
      format: "online",
    });
    expect(wrongDuration.status).toBe(403);
  });

  it("project meetings are denied without canView, and denied for request without canRequestMeeting even with canView", async () => {
    const { cookies, id } = await signupApprovedUser(adminCookies, "projectuser@example.com");
    const project = await request(app)
      .post("/api/projects")
      .set("Cookie", adminCookies)
      .send({ name: "Secret Project" });
    const projectId = project.body.project.id;

    const noAccess = await request(app).post("/api/meeting-requests").set("Cookie", cookies).send({
      category: "project",
      projectId,
      title: "Sync",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    expect(noAccess.status).toBe(403);

    // Grant view-only (e.g. via adding as a collaborator) — still can't request a meeting.
    await request(app).post(`/api/projects/${projectId}/collaborators`).set("Cookie", adminCookies).send({ userId: id });
    const viewOnly = await request(app).post("/api/meeting-requests").set("Cookie", cookies).send({
      category: "project",
      projectId,
      title: "Sync",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    expect(viewOnly.status).toBe(403);

    // Now grant request rights explicitly.
    await request(app)
      .patch(`/api/permissions/users/${id}/projects/${projectId}`)
      .set("Cookie", adminCookies)
      .send({ canRequestMeeting: true, canRequestOnline: true });

    const nowAllowed = await request(app).post("/api/meeting-requests").set("Cookie", cookies).send({
      category: "project",
      projectId,
      title: "Sync",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    expect(nowAllowed.status).toBe(201);
  });

  it("GET /api/projects/mine only returns projects the user has canView on, with private notes stripped", async () => {
    const { cookies, id } = await signupApprovedUser(adminCookies, "viewer@example.com");

    const visible = await request(app)
      .post("/api/projects")
      .set("Cookie", adminCookies)
      .send({ name: "Visible Project", notes: "admin eyes only" });
    const hidden = await request(app).post("/api/projects").set("Cookie", adminCookies).send({ name: "Hidden Project" });

    await request(app)
      .post(`/api/projects/${visible.body.project.id}/collaborators`)
      .set("Cookie", adminCookies)
      .send({ userId: id });

    const mine = await request(app).get("/api/projects/mine").set("Cookie", cookies);
    expect(mine.status).toBe(200);
    expect(mine.body.projects).toHaveLength(1);
    expect(mine.body.projects[0].name).toBe("Visible Project");
    expect(mine.body.projects[0].notes).toBeUndefined();

    const hiddenIds = mine.body.projects.map((p: { id: string }) => p.id);
    expect(hiddenIds).not.toContain(hidden.body.project.id);
  });

  it("a non-admin cannot read or write another user's permissions", async () => {
    const { cookies, id } = await signupApprovedUser(adminCookies, "target@example.com");
    const { cookies: otherCookies } = await signupApprovedUser(adminCookies, "attacker@example.com");

    const read = await request(app).get(`/api/permissions/users/${id}`).set("Cookie", otherCookies);
    expect(read.status).toBe(403);

    const write = await request(app)
      .patch(`/api/permissions/users/${id}`)
      .set("Cookie", otherCookies)
      .send({ canRequestGeneral: true });
    expect(write.status).toBe(403);
  });

  it("admins bypass all permission checks", async () => {
    const res = await request(app).post("/api/meeting-requests").set("Cookie", adminCookies).send({
      category: "general",
      title: "Self meeting",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    expect(res.status).toBe(201);
  });

  it("revoking a project permission reverts to default-deny", async () => {
    const { cookies, id } = await signupApprovedUser(adminCookies, "revoke@example.com");
    const project = await request(app).post("/api/projects").set("Cookie", adminCookies).send({ name: "Revoke Test" });
    const projectId = project.body.project.id;

    await request(app)
      .patch(`/api/permissions/users/${id}/projects/${projectId}`)
      .set("Cookie", adminCookies)
      .send({ canView: true, canRequestMeeting: true, canRequestOnline: true });

    const before = await request(app).post("/api/meeting-requests").set("Cookie", cookies).send({
      category: "project",
      projectId,
      title: "Sync",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    expect(before.status).toBe(201);

    await request(app).delete(`/api/permissions/users/${id}/projects/${projectId}`).set("Cookie", adminCookies);

    const after = await request(app).post("/api/meeting-requests").set("Cookie", cookies).send({
      category: "project",
      projectId,
      title: "Sync again",
      start: new Date(farFutureWeekday().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    expect(after.status).toBe(403);
  });
});
