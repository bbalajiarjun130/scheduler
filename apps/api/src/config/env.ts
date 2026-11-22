import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1).default("mongodb://localhost:27017/scheduler"),
  JWT_ACCESS_SECRET: z.string().min(32).default("dev-access-secret-change-me-dev-access-secret"),
  JWT_REFRESH_SECRET: z.string().min(32).default("dev-refresh-secret-change-me-dev-refresh-secret"),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32)
    .default("dev-token-encryption-key-change-me-32chars"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  APP_BASE_URL: z.string().default("http://localhost:4000"),
  WEB_BASE_URL: z.string().default("http://localhost:5173"),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Scheduler <noreply@scheduler.local>"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  ADMIN_SEED_EMAIL: z.string().optional(),
  ADMIN_SEED_PASSWORD: z.string().optional(),
  ADMIN_SEED_NAME: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

const devDefaultSecrets = [
  env.JWT_ACCESS_SECRET === "dev-access-secret-change-me-dev-access-secret",
  env.JWT_REFRESH_SECRET === "dev-refresh-secret-change-me-dev-refresh-secret",
  env.TOKEN_ENCRYPTION_KEY === "dev-token-encryption-key-change-me-32chars",
];
if (isProd && devDefaultSecrets.some(Boolean)) {
  throw new Error(
    "Refusing to start in production with default dev secrets. Set JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, and TOKEN_ENCRYPTION_KEY."
  );
}
