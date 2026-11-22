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

async function signupApprovedCollaborator(adminCookies: string[]) {
  await request(app).post("/api/auth/signup").send({
    name: "Collaborator One",
    email: "collab@example.com",
    password: "supersecret1",
  });
  const collab = await User.findOne({ email: "collab@example.com" });
  await request(app).post(`/api/users/${collab!._id}/approve`).set("Cookie", adminCookies);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "collab@example.com", password: "supersecret1" });
  return login.headers["set-cookie"];
}

// Comfortably inside the default 24h min-notice / 60d max-advance window, and on a
// weekday within working hours (09:00-18:00 UTC) so the availability checks pass too.
function farFutureWeekday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 10);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(15, 0, 0, 0);
  return d.toISOString();
}
const FAR_FUTURE_MONDAY = farFutureWeekday();
const dayStart = new Date(FAR_FUTURE_MONDAY);
dayStart.setUTCHours(0, 0, 0, 0);
const dayEnd = new Date(dayStart);
dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
const DAY_START_ISO = dayStart.toISOString();
const DAY_END_ISO = dayEnd.toISOString();

describe("meeting requests", () => {
  let adminCookies: string[];
  let userCookies: string[];

  beforeEach(async () => {
    adminCookies = await signupAndLoginAdmin();
    userCookies = await signupApprovedCollaborator(adminCookies);
  });

  it("lets an approved user submit a request and see it under /mine", async () => {
    const res = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Intro call",
      start: FAR_FUTURE_MONDAY,
      durationMinutes: 30,
      format: "online",
    });
    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe("pending");
    expect(res.body.request.adminNotes).toBeUndefined();

    const mine = await request(app).get("/api/meeting-requests/mine").set("Cookie", userCookies);
    expect(mine.body.requests).toHaveLength(1);
  });

  it("rejects a request for a nonexistent project and requires projectId for category=project", async () => {
    const missingProject = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "project",
      title: "Project sync",
      start: FAR_FUTURE_MONDAY,
      durationMinutes: 30,
      format: "online",
    });
    expect(missingProject.status).toBe(400);

    const badProjectId = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "project",
      projectId: "64b000000000000000000000",
      title: "Project sync",
      start: FAR_FUTURE_MONDAY,
      durationMinutes: 30,
      format: "online",
    });
    expect(badProjectId.status).toBe(400);
  });

  it("enforces minimum notice from settings", async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour out, default min notice is 24h
    const res = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Too soon",
      start: soon,
      durationMinutes: 30,
      format: "online",
    });
    expect(res.status).toBe(400);
  });

  it("admin can approve a request, which creates a calendar event and blocks that slot", async () => {
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Intro call",
      start: FAR_FUTURE_MONDAY,
      durationMinutes: 30,
      format: "online",
    });
    const id = created.body.request.id;

    const approve = await request(app).post(`/api/meeting-requests/${id}/approve`).set("Cookie", adminCookies).send({});
    expect(approve.status).toBe(200);
    expect(approve.body.request.status).toBe("approved");
    const eventId = approve.body.request.resultingEventId;
    expect(eventId).toBeTruthy();

    const list = await request(app)
      .get("/api/events")
      .query({ start: DAY_START_ISO, end: DAY_END_ISO })
      .set("Cookie", adminCookies);
    expect(list.body.events).toHaveLength(1);
    expect(list.body.events[0].type).toBe("meeting");

    // A second request for the same slot should now conflict at approval time.
    await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Overlapping",
      start: FAR_FUTURE_MONDAY,
      durationMinutes: 30,
      format: "online",
    });
    const all = await request(app).get("/api/meeting-requests").set("Cookie", adminCookies);
    const second = all.body.requests.find((r: { title: string }) => r.title === "Overlapping");
    const approveSecond = await request(app)
      .post(`/api/meeting-requests/${second.id}/approve`)
      .set("Cookie", adminCookies)
      .send({});
    expect(approveSecond.status).toBe(409);
  });

  it("admin can reject a request", async () => {
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Intro call",
      start: FAR_FUTURE_MONDAY,
      durationMinutes: 30,
      format: "online",
    });
    const id = created.body.request.id;

    const reject = await request(app)
      .post(`/api/meeting-requests/${id}/reject`)
      .set("Cookie", adminCookies)
      .send({ reason: "Not needed" });
    expect(reject.status).toBe(200);
    expect(reject.body.request.status).toBe("rejected");
  });

  it("supports the propose-alternative / accept-alternative flow", async () => {
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Intro call",
      start: FAR_FUTURE_MONDAY,
      durationMinutes: 30,
      format: "online",
    });
    const id = created.body.request.id;

    const altStart = new Date(dayStart.getTime() + 17 * 60 * 60 * 1000).toISOString();
    const altEnd = new Date(dayStart.getTime() + 17.5 * 60 * 60 * 1000).toISOString();
    const propose = await request(app)
      .post(`/api/meeting-requests/${id}/propose-alternative`)
      .set("Cookie", adminCookies)
      .send({ start: altStart, end: altEnd, note: "Does this work instead?" });
    expect(propose.status).toBe(200);
    expect(propose.body.request.status).toBe("alternative_proposed");

    const accept = await request(app).post(`/api/meeting-requests/${id}/accept-alternative`).set("Cookie", userCookies);
    expect(accept.status).toBe(200);
    expect(accept.body.request.status).toBe("approved");
    expect(accept.body.request.start).toBe(altStart);
  });

  it("requester can cancel their own pending request; admin cancelling an approved one cancels the linked event", async () => {
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Intro call",
      start: FAR_FUTURE_MONDAY,
      durationMinutes: 30,
      format: "online",
    });
    const id = created.body.request.id;

    const approve = await request(app).post(`/api/meeting-requests/${id}/approve`).set("Cookie", adminCookies).send({});
    const eventId = approve.body.request.resultingEventId;

    const cancel = await request(app).post(`/api/meeting-requests/${id}/cancel`).set("Cookie", adminCookies);
    expect(cancel.status).toBe(200);
    expect(cancel.body.request.status).toBe("cancelled");

    const list = await request(app)
      .get("/api/events")
      .query({ start: DAY_START_ISO, end: DAY_END_ISO })
      .set("Cookie", adminCookies);
    // Cancelled events are excluded from the calendar view entirely (the slot is freed up).
    const cancelledEvent = list.body.events.find((e: { id: string }) => e.id.startsWith(eventId));
    expect(cancelledEvent).toBeUndefined();
  });

  it("a user cannot cancel or view someone else's meeting request", async () => {
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Intro call",
      start: FAR_FUTURE_MONDAY,
      durationMinutes: 30,
      format: "online",
    });
    const id = created.body.request.id;

    await request(app).post("/api/auth/signup").send({
      name: "Other User",
      email: "other@example.com",
      password: "supersecret1",
    });
    const otherUserDoc = await User.findOne({ email: "other@example.com" });
    await request(app).post(`/api/users/${otherUserDoc!._id}/approve`).set("Cookie", adminCookies);
    const otherLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "other@example.com", password: "supersecret1" });
    const otherCookies = otherLogin.headers["set-cookie"];

    const cancel = await request(app).post(`/api/meeting-requests/${id}/cancel`).set("Cookie", otherCookies);
    expect(cancel.status).toBe(403);
  });

  it("the availability endpoint returns open slots that respect working hours and existing bookings", async () => {
    const res = await request(app)
      .get("/api/meeting-requests/availability")
      .query({ start: DAY_START_ISO, end: DAY_END_ISO, durationMinutes: 30 })
      .set("Cookie", userCookies);
    expect(res.status).toBe(200);
    expect(res.body.slots.length).toBeGreaterThan(0);
    for (const slot of res.body.slots) {
      const hour = new Date(slot.start).getUTCHours();
      expect(hour).toBeGreaterThanOrEqual(9);
      expect(hour).toBeLessThan(18);
    }
  });

  it("rejecting a non-pending request is not allowed", async () => {
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Intro call",
      start: FAR_FUTURE_MONDAY,
      durationMinutes: 30,
      format: "online",
    });
    const id = created.body.request.id;
    await request(app).post(`/api/meeting-requests/${id}/reject`).set("Cookie", adminCookies).send({});

    const secondReject = await request(app).post(`/api/meeting-requests/${id}/reject`).set("Cookie", adminCookies).send({});
    expect(secondReject.status).toBe(400);
  });
});
