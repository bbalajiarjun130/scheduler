import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import {
  signupSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@scheduler/shared";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateOpaqueToken,
  hashOpaqueToken,
} from "../utils/tokens.js";
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from "../utils/cookies.js";
import { toPublicUser } from "../utils/serializers.js";
import { emailProvider } from "../services/email/index.js";
import { verifyEmailTemplate, passwordResetTemplate } from "../services/email/templates.js";
import { notifyAllAdmins } from "../services/notificationService.js";
import { recordAudit } from "../services/auditService.js";
import { env } from "../config/env.js";

export const authRouter = Router();

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

authRouter.post(
  "/signup",
  strictAuthLimiter,
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);

    const existing = await User.findOne({ email: input.email });
    if (existing) throw ApiError.conflict("An account with this email already exists");

    const passwordHash = await bcrypt.hash(input.password, 12);
    const [rawVerifyToken, verifyTokenHash] = generateOpaqueToken();

    const isFirstUser = (await User.countDocuments({})) === 0;

    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: isFirstUser ? "admin" : "user",
      status: isFirstUser ? "approved" : "pending",
      emailVerifyTokenHash: verifyTokenHash,
      emailVerifyTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const verifyUrl = `${env.WEB_BASE_URL}/verify-email?token=${rawVerifyToken}`;
    const tpl = verifyEmailTemplate(user.name, verifyUrl);
    await emailProvider.send({ to: user.email, ...tpl });

    if (!isFirstUser) {
      await notifyAllAdmins({
        type: "user_registered",
        message: `${user.name} (${user.email}) registered and is awaiting approval.`,
        link: "/admin/users",
      });
    }

    res.status(201).json({
      message: "Account created. Check your email to verify your address.",
      user: toPublicUser(user),
    });
  })
);

authRouter.post(
  "/login",
  strictAuthLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);

    const user = await User.findOne({ email: input.email }).select("+passwordHash");
    if (!user) throw ApiError.unauthorized("Invalid email or password");

    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) throw ApiError.unauthorized("Invalid email or password");

    if (user.status === "rejected" || user.status === "suspended" || user.status === "deactivated") {
      throw ApiError.forbidden("Your account is not active. Contact the administrator.");
    }

    const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role, status: user.status });
    const refreshToken = signRefreshToken({ sub: user._id.toString(), version: user.refreshTokenVersion });
    setAuthCookies(res, accessToken, refreshToken);

    res.json({ user: toPublicUser(user) });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw ApiError.unauthorized();

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw ApiError.unauthorized();
    }

    const user = await User.findById(payload.sub);
    if (!user || user.refreshTokenVersion !== payload.version) throw ApiError.unauthorized();
    if (user.status === "rejected" || user.status === "suspended" || user.status === "deactivated") {
      throw ApiError.forbidden("Account is not active");
    }

    const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role, status: user.status });
    const refreshToken = signRefreshToken({ sub: user._id.toString(), version: user.refreshTokenVersion });
    setAuthCookies(res, accessToken, refreshToken);

    res.json({ user: toPublicUser(user) });
  })
);

authRouter.post("/logout", async (req, res) => {
  clearAuthCookies(res);
  res.status(204).send();
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: toPublicUser(req.user!) });
  })
);

authRouter.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const input = verifyEmailSchema.parse(req.body);
    const tokenHash = hashOpaqueToken(input.token);

    const user = await User.findOne({
      emailVerifyTokenHash: tokenHash,
      emailVerifyTokenExpires: { $gt: new Date() },
    }).select("+emailVerifyTokenHash +emailVerifyTokenExpires");

    if (!user) throw ApiError.badRequest("Invalid or expired verification link");

    user.emailVerified = true;
    user.emailVerifyTokenHash = undefined;
    user.emailVerifyTokenExpires = undefined;
    await user.save();

    res.json({ message: "Email verified" });
  })
);

authRouter.post(
  "/request-password-reset",
  strictAuthLimiter,
  asyncHandler(async (req, res) => {
    const input = requestPasswordResetSchema.parse(req.body);
    const user = await User.findOne({ email: input.email });

    if (user) {
      const [rawToken, tokenHash] = generateOpaqueToken();
      user.passwordResetTokenHash = tokenHash;
      user.passwordResetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      const resetUrl = `${env.WEB_BASE_URL}/reset-password?token=${rawToken}`;
      const tpl = passwordResetTemplate(user.name, resetUrl);
      await emailProvider.send({ to: user.email, ...tpl });
    }

    // Always return 200 to avoid leaking which emails are registered.
    res.json({ message: "If an account exists for that email, a reset link has been sent." });
  })
);

authRouter.post(
  "/reset-password",
  strictAuthLimiter,
  asyncHandler(async (req, res) => {
    const input = resetPasswordSchema.parse(req.body);
    const tokenHash = hashOpaqueToken(input.token);

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpires: { $gt: new Date() },
    }).select("+passwordResetTokenHash +passwordResetTokenExpires");

    if (!user) throw ApiError.badRequest("Invalid or expired reset link");

    user.passwordHash = await bcrypt.hash(input.password, 12);
    user.passwordResetTokenHash = undefined;
    user.passwordResetTokenExpires = undefined;
    user.refreshTokenVersion += 1;
    await user.save();

    await recordAudit({ actorId: user._id, action: "password_reset", targetType: "User", targetId: user._id });

    res.json({ message: "Password updated. You can now log in." });
  })
);
