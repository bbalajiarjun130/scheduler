import type { Response } from "express";
import { env, isProd } from "../config/env.js";

const ACCESS_COOKIE = "scheduler_at";
const REFRESH_COOKIE = "scheduler_rt";

// Cross-site cookies (separate frontend/backend domains in prod) require SameSite=None + Secure.
const baseCookieOpts = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/",
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, baseCookieOpts);
  res.clearCookie(REFRESH_COOKIE, baseCookieOpts);
}

export { ACCESS_COOKIE, REFRESH_COOKIE };
