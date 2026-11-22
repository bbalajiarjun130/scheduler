import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const verifyGoogleCredential = vi.fn();
vi.mock("../services/googleSignIn.js", () => ({
  verifyGoogleCredential: (...args: unknown[]) => verifyGoogleCredential(...args),
}));

const { createApp } = await import("../app.js");
const { User } = await import("../models/User.js");

const app = createApp();

describe("Google sign-in", () => {
  beforeEach(() => {
    verifyGoogleCredential.mockReset();
  });

  it("creates a new account on first Google sign-in (first ever user becomes admin)", async () => {
    verifyGoogleCredential.mockResolvedValue({
      googleId: "google-sub-1",
      email: "founder@example.com",
      name: "Founder",
      emailVerified: true,
    });

    const res = await request(app).post("/api/auth/google").send({ credential: "fake-token" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("admin");
    expect(res.body.user.status).toBe("approved");
    expect(res.body.user.emailVerified).toBe(true);

    const stored = await User.findOne({ email: "founder@example.com" }).select("+passwordHash");
    expect(stored?.passwordHash).toBeUndefined();
    expect(stored?.googleId).toBe("google-sub-1");
  });

  it("a second Google sign-in from a new identity lands pending", async () => {
    verifyGoogleCredential.mockResolvedValue({
      googleId: "google-sub-1",
      email: "founder@example.com",
      name: "Founder",
      emailVerified: true,
    });
    await request(app).post("/api/auth/google").send({ credential: "fake-token" });

    verifyGoogleCredential.mockResolvedValue({
      googleId: "google-sub-2",
      email: "second@example.com",
      name: "Second User",
      emailVerified: true,
    });
    const res = await request(app).post("/api/auth/google").send({ credential: "fake-token-2" });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe("pending");
  });

  it("links a Google identity to an existing password account with the same email", async () => {
    await request(app).post("/api/auth/signup").send({
      name: "Existing User",
      email: "existing@example.com",
      password: "supersecret1",
    });

    verifyGoogleCredential.mockResolvedValue({
      googleId: "google-sub-3",
      email: "existing@example.com",
      name: "Existing User",
      emailVerified: true,
    });
    const res = await request(app).post("/api/auth/google").send({ credential: "fake-token-3" });
    expect(res.status).toBe(200);

    const stored = await User.findOne({ email: "existing@example.com" }).select("+passwordHash");
    expect(stored?.googleId).toBe("google-sub-3");
    expect(stored?.passwordHash).toBeDefined(); // original password login still works
    expect(stored?.emailVerified).toBe(true);
  });

  it("rejects an unverified Google email", async () => {
    verifyGoogleCredential.mockResolvedValue({
      googleId: "google-sub-4",
      email: "unverified@example.com",
      name: "Unverified",
      emailVerified: false,
    });
    const res = await request(app).post("/api/auth/google").send({ credential: "fake-token-4" });
    expect(res.status).toBe(400);
  });

  it("a Google-only account cannot log in with a password", async () => {
    verifyGoogleCredential.mockResolvedValue({
      googleId: "google-sub-5",
      email: "googleonly@example.com",
      name: "Google Only",
      emailVerified: true,
    });
    await request(app).post("/api/auth/google").send({ credential: "fake-token-5" });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "googleonly@example.com", password: "whatever123" });
    expect(login.status).toBe(400);
  });

  it("blocks a suspended user from signing in via Google", async () => {
    verifyGoogleCredential.mockResolvedValue({
      googleId: "admin-sub",
      email: "admin@example.com",
      name: "Admin",
      emailVerified: true,
    });
    const adminRes = await request(app).post("/api/auth/google").send({ credential: "admin-token" });
    const adminCookies = adminRes.headers["set-cookie"];

    verifyGoogleCredential.mockResolvedValue({
      googleId: "google-sub-6",
      email: "suspendme@example.com",
      name: "Suspend Me",
      emailVerified: true,
    });
    await request(app).post("/api/auth/google").send({ credential: "fake-token-6" });
    const target = await User.findOne({ email: "suspendme@example.com" });

    await request(app).post(`/api/users/${target!._id}/approve`).set("Cookie", adminCookies);
    await request(app).post(`/api/users/${target!._id}/suspend`).set("Cookie", adminCookies);

    const res = await request(app).post("/api/auth/google").send({ credential: "fake-token-6" });
    expect(res.status).toBe(403);
  });
});
