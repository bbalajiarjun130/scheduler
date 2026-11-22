import crypto from "node:crypto";
import { google } from "googleapis";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { GoogleIntegration, getGoogleIntegration } from "../models/GoogleIntegration.js";
import { encryptSecret, decryptSecret } from "../utils/encryption.js";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"];

// `googleapis` vendors its own internal copy of google-auth-library, whose OAuth2Client
// type doesn't structurally match the standalone `google-auth-library` package used for
// sign-in (googleSignIn.ts) — mixing them produces type errors on calendar()/oauth2().
// Using `google.auth.OAuth2`'s own instance type keeps this file self-consistent.
type GoogleOAuthClient = InstanceType<typeof google.auth.OAuth2>;

function assertConfigured(): void {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw ApiError.badRequest("Google Calendar integration is not configured on this server yet.");
  }
}

function buildOAuthClient(): GoogleOAuthClient {
  assertConfigured();
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

export function getConsentUrl(state: string): string {
  const client = buildOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function handleOAuthCallback(code: string, connectedByUserId: string): Promise<void> {
  const client = buildOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw ApiError.badRequest(
      "Google didn't return a refresh token. Remove the app's access in your Google Account's third-party access settings and try connecting again."
    );
  }
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();

  await GoogleIntegration.findOneAndUpdate(
    { singletonKey: "default" },
    {
      singletonKey: "default",
      status: "connected",
      connectedByUserId,
      googleEmail: data.email ?? undefined,
      scopes: tokens.scope?.split(" ") ?? SCOPES,
      encryptedRefreshToken: encryptSecret(tokens.refresh_token),
      connectedAt: new Date(),
    },
    { upsert: true }
  );
}

export async function disconnectGoogle(): Promise<void> {
  await GoogleIntegration.findOneAndUpdate(
    { singletonKey: "default" },
    { status: "disconnected", $unset: { encryptedRefreshToken: "" } },
    {}
  );
}

export async function getIntegrationStatus() {
  const integration = await GoogleIntegration.findOne({ singletonKey: "default" });
  return {
    connected: integration?.status === "connected",
    status: integration?.status ?? "disconnected",
    googleEmail: integration?.googleEmail ?? undefined,
    connectedAt: integration?.connectedAt?.toISOString(),
  };
}

async function getAuthorizedClient(): Promise<GoogleOAuthClient> {
  assertConfigured();
  const integration = await getGoogleIntegration();
  if (!integration || integration.status !== "connected" || !integration.encryptedRefreshToken) {
    throw ApiError.badRequest("Google Calendar is not connected. Connect it from Settings.");
  }
  const client = buildOAuthClient();
  client.setCredentials({ refresh_token: decryptSecret(integration.encryptedRefreshToken) });
  return client;
}

async function markNeedsReauth(): Promise<void> {
  await GoogleIntegration.findOneAndUpdate({ singletonKey: "default" }, { status: "needs_reauth" });
}

function errorStatus(err: unknown): number | undefined {
  const withCode = err as { code?: number | string; status?: number; response?: { status?: number } };
  const code = withCode.code ?? withCode.status ?? withCode.response?.status;
  return typeof code === "number" ? code : typeof code === "string" ? Number(code) : undefined;
}

export interface SyncEventInput {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  timezone: string;
  attendeeEmails: string[];
  location?: string;
  isOnline: boolean;
}

export interface SyncEventResult {
  googleEventId: string;
  meetUrl?: string;
}

/**
 * Creates the Google Calendar event (with an auto-generated Meet link for online
 * meetings). Returns undefined if Google isn't connected or the sync otherwise fails —
 * Google sync is strictly best-effort and must never block the actual approval, since
 * our own CalendarEvent is the source of truth per the app's design.
 */
export async function createGoogleCalendarEvent(input: SyncEventInput): Promise<SyncEventResult | undefined> {
  try {
    const client = await getAuthorizedClient();
    const calendar = google.calendar({ version: "v3", auth: client });
    const res = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: input.isOnline ? 1 : 0,
      sendUpdates: "all",
      requestBody: {
        summary: input.title,
        description: input.description,
        location: input.location,
        start: { dateTime: input.start.toISOString(), timeZone: input.timezone },
        end: { dateTime: input.end.toISOString(), timeZone: input.timezone },
        attendees: input.attendeeEmails.map((email) => ({ email })),
        conferenceData: input.isOnline
          ? { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } }
          : undefined,
      },
    });
    const googleEventId = res.data.id;
    if (!googleEventId) return undefined;
    return { googleEventId, meetUrl: res.data.hangoutLink ?? undefined };
  } catch (err) {
    const status = errorStatus(err);
    if (status === 401 || status === 403) await markNeedsReauth();
    console.error("[google-calendar] failed to create event:", err);
    return undefined;
  }
}

export async function updateGoogleCalendarEvent(
  googleEventId: string,
  patch: Partial<Pick<SyncEventInput, "title" | "description" | "start" | "end" | "timezone" | "location">>
): Promise<boolean> {
  try {
    const client = await getAuthorizedClient();
    const calendar = google.calendar({ version: "v3", auth: client });
    await calendar.events.patch({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "all",
      requestBody: {
        summary: patch.title,
        description: patch.description,
        location: patch.location,
        start: patch.start ? { dateTime: patch.start.toISOString(), timeZone: patch.timezone } : undefined,
        end: patch.end ? { dateTime: patch.end.toISOString(), timeZone: patch.timezone } : undefined,
      },
    });
    return true;
  } catch (err) {
    const status = errorStatus(err);
    if (status === 404 || status === 410) return true; // already gone on Google's side — nothing to patch
    if (status === 401 || status === 403) await markNeedsReauth();
    console.error("[google-calendar] failed to update event:", err);
    return false;
  }
}

export async function deleteGoogleCalendarEvent(googleEventId: string): Promise<boolean> {
  try {
    const client = await getAuthorizedClient();
    const calendar = google.calendar({ version: "v3", auth: client });
    await calendar.events.delete({ calendarId: "primary", eventId: googleEventId, sendUpdates: "all" });
    return true;
  } catch (err) {
    const status = errorStatus(err);
    if (status === 404 || status === 410) return true; // already deleted on Google's side
    if (status === 401 || status === 403) await markNeedsReauth();
    console.error("[google-calendar] failed to delete event:", err);
    return false;
  }
}
