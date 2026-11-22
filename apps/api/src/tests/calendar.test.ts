import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

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

describe("calendar events + conflict detection", () => {
  let cookies: string[];

  beforeEach(async () => {
    cookies = await signupAndLoginAdmin();
  });

  it("creates an event and lists it within a range", async () => {
    const start = "2027-01-04T15:00:00.000Z"; // Monday
    const end = "2027-01-04T16:00:00.000Z";

    const create = await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({ type: "meeting", title: "Kickoff", start, end, timezone: "UTC" });
    expect(create.status).toBe(201);

    const list = await request(app)
      .get("/api/events")
      .query({ start: "2027-01-01T00:00:00.000Z", end: "2027-01-08T00:00:00.000Z" })
      .set("Cookie", cookies);
    expect(list.status).toBe(200);
    expect(list.body.events).toHaveLength(1);
    expect(list.body.events[0].title).toBe("Kickoff");
  });

  it("rejects a conflicting event and allows an explicit override", async () => {
    const start = "2027-01-04T15:00:00.000Z";
    const end = "2027-01-04T16:00:00.000Z";

    await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({ type: "meeting", title: "First", start, end, timezone: "UTC" });

    const conflicting = await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({ type: "meeting", title: "Overlapping", start, end, timezone: "UTC" });
    expect(conflicting.status).toBe(409);

    const overridden = await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({ type: "blocked", title: "Manual override", start, end, timezone: "UTC", overrideConflicts: true });
    expect(overridden.status).toBe(201);
  });

  it("respects the configured buffer between events", async () => {
    await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({
        type: "meeting",
        title: "First",
        start: "2027-01-04T15:00:00.000Z",
        end: "2027-01-04T16:00:00.000Z",
        timezone: "UTC",
      });

    // Starts exactly when "First" ends — still within the default 10-minute buffer.
    const tooClose = await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({
        type: "meeting",
        title: "Too close",
        start: "2027-01-04T16:00:00.000Z",
        end: "2027-01-04T17:00:00.000Z",
        timezone: "UTC",
      });
    expect(tooClose.status).toBe(409);

    const farEnough = await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({
        type: "meeting",
        title: "Far enough",
        start: "2027-01-04T16:15:00.000Z",
        end: "2027-01-04T17:00:00.000Z",
        timezone: "UTC",
      });
    expect(farEnough.status).toBe(201);
  });

  it("expands a recurring weekly event across multiple weeks", async () => {
    const create = await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({
        type: "work_session",
        title: "Weekly writing block",
        start: "2027-01-04T15:00:00.000Z",
        end: "2027-01-04T17:00:00.000Z",
        timezone: "UTC",
        recurrenceRule: "FREQ=WEEKLY;COUNT=4",
      });
    expect(create.status).toBe(201);

    const list = await request(app)
      .get("/api/events")
      .query({ start: "2027-01-01T00:00:00.000Z", end: "2027-02-01T00:00:00.000Z" })
      .set("Cookie", cookies);
    expect(list.body.events).toHaveLength(4);
  });

  it("supports editing a single occurrence of a recurring event without affecting the rest", async () => {
    await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({
        type: "work_session",
        title: "Weekly writing block",
        start: "2027-01-04T15:00:00.000Z",
        end: "2027-01-04T17:00:00.000Z",
        timezone: "UTC",
        recurrenceRule: "FREQ=WEEKLY;COUNT=4",
      });

    const list1 = await request(app)
      .get("/api/events")
      .query({ start: "2027-01-01T00:00:00.000Z", end: "2027-02-01T00:00:00.000Z" })
      .set("Cookie", cookies);
    const masterId = list1.body.events[0].masterId;
    const secondOccurrenceStart = list1.body.events[1].start;

    const moved = await request(app)
      .patch(`/api/events/${masterId}`)
      .set("Cookie", cookies)
      .send({
        scope: "instance",
        occurrenceStart: secondOccurrenceStart,
        start: "2027-01-12T18:00:00.000Z",
        end: "2027-01-12T20:00:00.000Z",
      });
    expect(moved.status).toBe(200);

    const list2 = await request(app)
      .get("/api/events")
      .query({ start: "2027-01-01T00:00:00.000Z", end: "2027-02-01T00:00:00.000Z" })
      .set("Cookie", cookies);
    expect(list2.body.events).toHaveLength(4);
    const movedOccurrence = list2.body.events.find((e: { start: string }) => e.start === "2027-01-12T18:00:00.000Z");
    expect(movedOccurrence).toBeTruthy();
  });

  it("cancelling a single occurrence removes only that one from the series", async () => {
    await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({
        type: "work_session",
        title: "Weekly writing block",
        start: "2027-01-04T15:00:00.000Z",
        end: "2027-01-04T17:00:00.000Z",
        timezone: "UTC",
        recurrenceRule: "FREQ=WEEKLY;COUNT=4",
      });

    const list1 = await request(app)
      .get("/api/events")
      .query({ start: "2027-01-01T00:00:00.000Z", end: "2027-02-01T00:00:00.000Z" })
      .set("Cookie", cookies);
    const masterId = list1.body.events[0].masterId;
    const firstOccurrenceStart = list1.body.events[0].start;

    const del = await request(app)
      .delete(`/api/events/${masterId}`)
      .query({ scope: "instance", occurrenceStart: firstOccurrenceStart })
      .set("Cookie", cookies);
    expect(del.status).toBe(204);

    const list2 = await request(app)
      .get("/api/events")
      .query({ start: "2027-01-01T00:00:00.000Z", end: "2027-02-01T00:00:00.000Z" })
      .set("Cookie", cookies);
    expect(list2.body.events).toHaveLength(3);
  });

  it("non-admins cannot access any calendar event endpoints", async () => {
    await request(app).post("/api/auth/signup").send({
      name: "Admin User",
      email: "admin@example.com",
      password: "supersecret1",
    });
    await request(app).post("/api/auth/signup").send({
      name: "Normal User",
      email: "user@example.com",
      password: "supersecret1",
    });
    const userLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "supersecret1" });
    const userCookies = userLogin.headers["set-cookie"];

    const res = await request(app)
      .get("/api/events")
      .query({ start: "2027-01-01T00:00:00.000Z", end: "2027-02-01T00:00:00.000Z" })
      .set("Cookie", userCookies);
    expect(res.status).toBe(403);
  });
});
