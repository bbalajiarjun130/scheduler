import { env } from "../../config/env.js";
import type { EmailProvider } from "./EmailProvider.js";
import { ConsoleProvider } from "./ConsoleProvider.js";
import { ResendProvider } from "./ResendProvider.js";

export const emailProvider: EmailProvider = env.RESEND_API_KEY
  ? new ResendProvider(env.RESEND_API_KEY)
  : new ConsoleProvider();

export * from "./EmailProvider.js";
