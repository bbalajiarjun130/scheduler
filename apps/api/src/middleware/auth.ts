import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { ACCESS_COOKIE } from "../utils/cookies.js";
import { User, type UserDoc } from "../models/User.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) throw ApiError.unauthorized();

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user) throw ApiError.unauthorized();
    if (user.status === "suspended" || user.status === "deactivated" || user.status === "rejected") {
      throw ApiError.forbidden("Account is not active");
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(ApiError.unauthorized());
  }
}

export function requireRole(...roles: Array<"admin" | "user">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}

export function requireApproved(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role === "admin") return next();
  if (req.user.status !== "approved") {
    return next(ApiError.forbidden("Account is pending approval"));
  }
  next();
}
