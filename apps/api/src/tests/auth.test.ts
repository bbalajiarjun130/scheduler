import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { User } from "../models/User.js";

const app = createApp();

describe("auth + registration approval flow", () => {
  it("first signup becomes an approved admin", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "Admin User",
      email: "admin@example.com",
      password: "supersecret1",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("admin");
    expect(res.body.user.status).toBe("approved");
  });

  it("second signup is pending and cannot use scheduling until approved", async () => {
    await request(app).post("/api/auth/signup").send({
      name: "Admin User",
      email: "admin@example.com",
      password: "supersecret1",
    });

    const signup = await request(app).post("/api/auth/signup").send({
      name: "Normal User",
      email: "user@example.com",
      password: "supersecret1",
    });
    expect(signup.status).toBe(201);
    expect(signup.body.user.status).toBe("pending");

    const login = await request(app).post("/api/auth/login").send({
      email: "user@example.com",
      password: "supersecret1",
    });
    expect(login.status).toBe(200);
    const cookies = login.headers["set-cookie"];

    const me = await request(app).get("/api/auth/me").set("Cookie", cookies);
    expect(me.status).toBe(200);
    expect(me.body.user.status).toBe("pending");
  });

  it("rejects login with wrong password", async () => {
    await request(app).post("/api/auth/signup").send({
      name: "Admin User",
      email: "admin@example.com",
      password: "supersecret1",
    });

    const login = await request(app).post("/api/auth/login").send({
      email: "admin@example.com",
      password: "wrongpass",
    });
    expect(login.status).toBe(401);
  });

  it("admin can approve a pending user, who can then access scheduling-gated routes", async () => {
    await request(app).post("/api/auth/signup").send({
      name: "Admin User",
      email: "admin@example.com",
      password: "supersecret1",
    });
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "supersecret1" });
    const adminCookies = adminLogin.headers["set-cookie"];

    await request(app).post("/api/auth/signup").send({
      name: "Normal User",
      email: "user@example.com",
      password: "supersecret1",
    });
    const pendingUser = await User.findOne({ email: "user@example.com" });

    const approve = await request(app)
      .post(`/api/users/${pendingUser!._id}/approve`)
      .set("Cookie", adminCookies);
    expect(approve.status).toBe(200);
    expect(approve.body.user.status).toBe("approved");

    const userLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "supersecret1" });
    expect(userLogin.body.user.status).toBe("approved");
  });

  it("a non-admin cannot access the admin user list", async () => {
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

    const res = await request(app).get("/api/users").set("Cookie", userCookies);
    expect(res.status).toBe(403);
  });

  it("rejected users cannot log in", async () => {
    await request(app).post("/api/auth/signup").send({
      name: "Admin User",
      email: "admin@example.com",
      password: "supersecret1",
    });
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "supersecret1" });
    const adminCookies = adminLogin.headers["set-cookie"];

    await request(app).post("/api/auth/signup").send({
      name: "Normal User",
      email: "user@example.com",
      password: "supersecret1",
    });
    const pendingUser = await User.findOne({ email: "user@example.com" });

    await request(app).post(`/api/users/${pendingUser!._id}/reject`).set("Cookie", adminCookies).send({
      reason: "not a fit",
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "supersecret1" });
    expect(login.status).toBe(403);
  });
});
