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

async function signupApprovedCollaborator(cookies: string[]) {
  await request(app).post("/api/auth/signup").send({
    name: "Collaborator One",
    email: "collab@example.com",
    password: "supersecret1",
  });
  const collab = await User.findOne({ email: "collab@example.com" });
  await request(app).post(`/api/users/${collab!._id}/approve`).set("Cookie", cookies);
  return collab!._id.toString();
}

describe("projects + work sessions", () => {
  let cookies: string[];

  beforeEach(async () => {
    cookies = await signupAndLoginAdmin();
  });

  it("creates, lists, and archives a project", async () => {
    const create = await request(app)
      .post("/api/projects")
      .set("Cookie", cookies)
      .send({ name: "Short Film", category: "Film", color: "#4f46e5" });
    expect(create.status).toBe(201);
    expect(create.body.project.archived).toBe(false);
    expect(create.body.project.totalScheduledHours).toBe(0);

    const id = create.body.project.id;

    const archive = await request(app)
      .patch(`/api/projects/${id}`)
      .set("Cookie", cookies)
      .send({ archived: true });
    expect(archive.status).toBe(200);
    expect(archive.body.project.archived).toBe(true);

    const activeList = await request(app).get("/api/projects").set("Cookie", cookies);
    expect(activeList.body.projects).toHaveLength(0);

    const fullList = await request(app).get("/api/projects?includeArchived=true").set("Cookie", cookies);
    expect(fullList.body.projects).toHaveLength(1);
  });

  it("assigns and removes collaborators", async () => {
    const userId = await signupApprovedCollaborator(cookies);
    const create = await request(app)
      .post("/api/projects")
      .set("Cookie", cookies)
      .send({ name: "Acting Portfolio" });
    const id = create.body.project.id;

    const add = await request(app)
      .post(`/api/projects/${id}/collaborators`)
      .set("Cookie", cookies)
      .send({ userId });
    expect(add.status).toBe(200);
    expect(add.body.project.collaborators).toHaveLength(1);
    expect(add.body.project.collaborators[0].email).toBe("collab@example.com");

    const remove = await request(app)
      .delete(`/api/projects/${id}/collaborators/${userId}`)
      .set("Cookie", cookies);
    expect(remove.status).toBe(200);
    expect(remove.body.project.collaborators).toHaveLength(0);
  });

  it("tracks scheduled and completed hours from linked work sessions", async () => {
    const create = await request(app)
      .post("/api/projects")
      .set("Cookie", cookies)
      .send({ name: "Screenplay Writing" });
    const projectId = create.body.project.id;

    const session = await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({
        type: "work_session",
        title: "Writing block",
        start: "2027-03-01T09:00:00.000Z",
        end: "2027-03-01T12:00:00.000Z",
        timezone: "UTC",
        projectId,
      });
    expect(session.status).toBe(201);

    const afterCreate = await request(app).get(`/api/projects/${projectId}`).set("Cookie", cookies);
    expect(afterCreate.body.project.totalScheduledHours).toBe(3);
    expect(afterCreate.body.project.totalCompletedHours).toBe(0);

    const masterId = session.body.event.masterId;
    const complete = await request(app)
      .patch(`/api/events/${masterId}`)
      .set("Cookie", cookies)
      .send({ status: "completed", completedHours: 2.5 });
    expect(complete.status).toBe(200);

    const afterComplete = await request(app).get(`/api/projects/${projectId}`).set("Cookie", cookies);
    expect(afterComplete.body.project.totalCompletedHours).toBe(2.5);
  });

  it("prevents deleting a project from breaking existing calendar history (detaches instead)", async () => {
    const create = await request(app).post("/api/projects").set("Cookie", cookies).send({ name: "Temp Project" });
    const projectId = create.body.project.id;

    await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({
        type: "work_session",
        title: "Session",
        start: "2027-03-02T09:00:00.000Z",
        end: "2027-03-02T10:00:00.000Z",
        timezone: "UTC",
        projectId,
      });

    const del = await request(app).delete(`/api/projects/${projectId}`).set("Cookie", cookies);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get("/api/events")
      .query({ start: "2027-03-01T00:00:00.000Z", end: "2027-03-03T00:00:00.000Z" })
      .set("Cookie", cookies);
    expect(list.body.events).toHaveLength(1);
    expect(list.body.events[0].projectId).toBeUndefined();
  });

  it("rejects creating a work session against a nonexistent project", async () => {
    const res = await request(app)
      .post("/api/events")
      .set("Cookie", cookies)
      .send({
        type: "work_session",
        title: "Orphan session",
        start: "2027-03-01T09:00:00.000Z",
        end: "2027-03-01T10:00:00.000Z",
        timezone: "UTC",
        projectId: "64b000000000000000000000",
      });
    expect(res.status).toBe(400);
  });

  it("non-admins cannot access project endpoints", async () => {
    await signupApprovedCollaborator(cookies);
    const userLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "collab@example.com", password: "supersecret1" });
    const userCookies = userLogin.headers["set-cookie"];

    const res = await request(app).get("/api/projects").set("Cookie", userCookies);
    expect(res.status).toBe(403);
  });
});
