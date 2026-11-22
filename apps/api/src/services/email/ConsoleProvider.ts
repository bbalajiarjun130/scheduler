import type { EmailMessage, EmailProvider } from "./EmailProvider.js";

/** Fallback used when no email provider API key is configured. Logs instead of sending. */
export class ConsoleProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log("[email:stub] not sent (no provider configured) ->", {
      to: message.to,
      subject: message.subject,
      preview: message.text ?? message.html.slice(0, 200),
    });
  }
}
