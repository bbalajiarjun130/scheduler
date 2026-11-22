import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  role: "admin" | "user";
  status: string;
}

export interface RefreshTokenPayload {
  sub: string;
  version: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

/** Returns [rawToken, sha256Hash]. Store only the hash; email/send only the raw token. */
export function generateOpaqueToken(): [string, string] {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return [raw, hash];
}

export function hashOpaqueToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Short-lived signed state for the Google OAuth redirect round-trip (CSRF protection). */
export function signOAuthState(adminUserId: string): string {
  return jwt.sign({ sub: adminUserId }, env.JWT_ACCESS_SECRET, { expiresIn: "10m" });
}

export function verifyOAuthState(state: string): string {
  const payload = jwt.verify(state, env.JWT_ACCESS_SECRET) as { sub: string };
  return payload.sub;
}
