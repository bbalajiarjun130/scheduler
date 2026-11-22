import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

let client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID) {
    throw ApiError.badRequest("Google sign-in is not configured on this server yet.");
  }
  if (!client) client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  return client;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

/** Verifies a Google Identity Services ID token (the `credential` from the Sign-In button). */
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  const ticket = await getClient().verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw ApiError.badRequest("Invalid Google credential");
  }
  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name ?? payload.email,
    emailVerified: payload.email_verified ?? false,
  };
}
