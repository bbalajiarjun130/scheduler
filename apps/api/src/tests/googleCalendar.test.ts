import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const createGoogleCalendarEvent = vi.fn();
const updateGoogleCalendarEvent = vi.fn();
const deleteGoogleCalendarEvent = vi.fn();
const getConsentUrl = vi.fn();
const getIntegrationStatus = vi.fn();
const disconnectGoogle = vi.fn();
const handleOAuthCallback = vi.fn();

vi.mock("../services/googleCalendarService.js", () => ({
  createGoogleCalendarEvent: (...args: unknown[]) => createGoogleCalendarEvent(...args),
  updateGoogleCalendarEvent: (...args: unknown[]) => updateGoogleCalendarEvent(...args),
  deleteGoogleCalendarEvent: (...args: unknown[]) => deleteGoogleCalendarEvent(...args),
  getConsentUrl: (...args: unknown[]) => getConsentUrl(...args),
  getIntegrationStatus: (...args: unknown[]) => getIntegrationStatus(...args),
  disconnectGoogle: (...args: unknown[]) => disconnectGoogle(...args),
  handleOAuthCallback: (...args: unknown[]) => handleOAuthCallback(...args),
}));

const { createApp } = await import("../app.js");

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
  const { User } = await import("../models/User.js");
  const { UserPermissions } = await import("../models/UserPermissions.js");
  await request(app).post("/api/auth/signup").send({ name: "Test User", email, password: "supersecret1" });
  const user = await User.findOne({ email });
  await request(app).post(`/api/users/${user!._id}/approve`).set("Cookie", adminCookies);
  await UserPermissions.create({
    userId: user!._id,
    canRequestGeneral: true,
    canSeeGeneralAvailability: true,
    canRequestOnline: true,
  });
  const login = await request(app).post("/api/auth/login").send({ email, password: "supersecret1" });
  return login.headers["set-cookie"] as string[];
}

function farFutureWeekday(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 10);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(15, 0, 0, 0);
  return d;
}

describe("Google Calendar integration", () => {
  let adminCookies: string[];

  beforeEach(async () => {
    createGoogleCalendarEvent.mockReset();
    updateGoogleCalendarEvent.mockReset();
    deleteGoogleCalendarEvent.mockReset();
    getConsentUrl.mockReset();
    getIntegrationStatus.mockReset();
    disconnectGoogle.mockReset();
    adminCookies = await signupAndLoginAdmin();
  });

  it("non-admins cannot reach any integration endpoint", async () => {
    const userCookies = await signupApprovedUser(adminCookies, "collab@example.com");
    const status = await request(app).get("/api/integrations/google/status").set("Cookie", userCookies);
    expect(status.status).toBe(403);
    const connect = await request(app).get("/api/integrations/google/connect").set("Cookie", userCookies);
    expect(connect.status).toBe(403);
    const disconnect = await request(app).post("/api/integrations/google/disconnect").set("Cookie", userCookies);
    expect(disconnect.status).toBe(403);
  });

  it("admin can read status and get a consent URL", async () => {
    getIntegrationStatus.mockResolvedValue({ connected: false, status: "disconnected" });
    getConsentUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?mocked=1");

    const status = await request(app).get("/api/integrations/google/status").set("Cookie", adminCookies);
    expect(status.status).toBe(200);
    expect(status.body.connected).toBe(false);

    const connect = await request(app).get("/api/integrations/google/connect").set("Cookie", adminCookies);
    expect(connect.status).toBe(200);
    expect(connect.body.url).toContain("accounts.google.com");
    expect(getConsentUrl).toHaveBeenCalledOnce();
  });

  it("approving an online meeting syncs to Google Calendar and surfaces the Meet link", async () => {
    createGoogleCalendarEvent.mockResolvedValue({ googleEventId: "gcal-123", meetUrl: "https://meet.google.com/abc-defg-hij" });

    const userCookies = await signupApprovedUser(adminCookies, "collab2@example.com");
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Sync call",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "online",
    });

    const approve = await request(app)
      .post(`/api/meeting-requests/${created.body.request.id}/approve`)
      .set("Cookie", adminCookies)
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body.request.meetUrl).toBe("https://meet.google.com/abc-defg-hij");
    expect(createGoogleCalendarEvent).toHaveBeenCalledOnce();
    expect(createGoogleCalendarEvent.mock.calls[0][0]).toMatchObject({
      isOnline: true,
      attendeeEmails: ["collab2@example.com"],
    });
  });

  it("approval still succeeds even if the Google sync fails (best-effort, never blocking)", async () => {
    createGoogleCalendarEvent.mockResolvedValue(undefined);

    const userCookies = await signupApprovedUser(adminCookies, "collab3@example.com");
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Sync call",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "online",
    });

    const approve = await request(app)
      .post(`/api/meeting-requests/${created.body.request.id}/approve`)
      .set("Cookie", adminCookies)
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body.request.status).toBe("approved");
    expect(approve.body.request.meetUrl).toBeUndefined();
  });

  it("an in-person meeting does not trigger a Google Calendar sync", async () => {
    const userCookies = await signupApprovedUser(adminCookies, "collab4@example.com");
    await request(app)
      .patch(`/api/permissions/users/${(await (await import("../models/User.js")).User.findOne({ email: "collab4@example.com" }))!._id}`)
      .set("Cookie", adminCookies)
      .send({ canRequestInPerson: true });

    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Coffee",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "in_person",
      location: "Cafe",
    });

    await request(app).post(`/api/meeting-requests/${created.body.request.id}/approve`).set("Cookie", adminCookies).send({});
    expect(createGoogleCalendarEvent).not.toHaveBeenCalled();
  });

  it("cancelling an approved online meeting deletes the Google Calendar event", async () => {
    createGoogleCalendarEvent.mockResolvedValue({ googleEventId: "gcal-456", meetUrl: "https://meet.google.com/xyz" });
    deleteGoogleCalendarEvent.mockResolvedValue(true);

    const userCookies = await signupApprovedUser(adminCookies, "collab5@example.com");
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Sync call",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    const approved = await request(app)
      .post(`/api/meeting-requests/${created.body.request.id}/approve`)
      .set("Cookie", adminCookies)
      .send({});

    const cancel = await request(app)
      .post(`/api/meeting-requests/${created.body.request.id}/cancel`)
      .set("Cookie", adminCookies);
    expect(cancel.status).toBe(200);
    expect(deleteGoogleCalendarEvent).toHaveBeenCalledWith("gcal-456");
    void approved;
  });

  it("rescheduling a meeting event directly on the calendar updates the Google Calendar event", async () => {
    createGoogleCalendarEvent.mockResolvedValue({ googleEventId: "gcal-789", meetUrl: "https://meet.google.com/resched" });
    updateGoogleCalendarEvent.mockResolvedValue(true);

    const userCookies = await signupApprovedUser(adminCookies, "collab6@example.com");
    const created = await request(app).post("/api/meeting-requests").set("Cookie", userCookies).send({
      category: "general",
      title: "Sync call",
      start: farFutureWeekday().toISOString(),
      durationMinutes: 30,
      format: "online",
    });
    const approve = await request(app)
      .post(`/api/meeting-requests/${created.body.request.id}/approve`)
      .set("Cookie", adminCookies)
      .send({});
    const eventId = approve.body.request.resultingEventId;

    const newStart = new Date(farFutureWeekday().getTime() + 24 * 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + 30 * 60 * 1000);
    const patch = await request(app)
      .patch(`/api/events/${eventId}`)
      .set("Cookie", adminCookies)
      .send({ start: newStart.toISOString(), end: newEnd.toISOString() });
    expect(patch.status).toBe(200);
    expect(updateGoogleCalendarEvent).toHaveBeenCalledWith("gcal-789", expect.objectContaining({}));
  });
});
