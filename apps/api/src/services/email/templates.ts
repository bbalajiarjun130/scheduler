export function verifyEmailTemplate(name: string, verifyUrl: string) {
  return {
    subject: "Verify your email",
    html: `<p>Hi ${name},</p><p>Please verify your email by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    text: `Hi ${name}, verify your email: ${verifyUrl}`,
  };
}

export function passwordResetTemplate(name: string, resetUrl: string) {
  return {
    subject: "Reset your password",
    html: `<p>Hi ${name},</p><p>Reset your password using the link below. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    text: `Hi ${name}, reset your password: ${resetUrl}`,
  };
}

export function newRegistrationAdminTemplate(name: string, email: string) {
  return {
    subject: `New registration: ${name}`,
    html: `<p>${name} (${email}) just registered and is awaiting approval.</p>`,
    text: `${name} (${email}) just registered and is awaiting approval.`,
  };
}

export function accountApprovedTemplate(name: string, loginUrl: string) {
  return {
    subject: "Your account has been approved",
    html: `<p>Hi ${name},</p><p>Your account has been approved. You can now log in.</p><p><a href="${loginUrl}">${loginUrl}</a></p>`,
    text: `Hi ${name}, your account has been approved. Log in: ${loginUrl}`,
  };
}

export function accountRejectedTemplate(name: string, reason?: string) {
  return {
    subject: "Your registration was not approved",
    html: `<p>Hi ${name},</p><p>Your registration was not approved.${reason ? ` Reason: ${reason}` : ""}</p>`,
    text: `Hi ${name}, your registration was not approved.${reason ? ` Reason: ${reason}` : ""}`,
  };
}

function fmt(date: Date) {
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

export function meetingApprovedTemplate(name: string, title: string, start: Date, meetUrl?: string, location?: string) {
  return {
    subject: `Meeting approved: ${title}`,
    html: `<p>Hi ${name},</p><p>Your meeting "${title}" is confirmed for ${fmt(start)}.</p>${meetUrl ? `<p>Join: <a href="${meetUrl}">${meetUrl}</a></p>` : ""}${location ? `<p>Location: ${location}</p>` : ""}`,
    text: `Hi ${name}, your meeting "${title}" is confirmed for ${fmt(start)}.${meetUrl ? ` Join: ${meetUrl}` : ""}${location ? ` Location: ${location}` : ""}`,
  };
}

export function meetingRejectedTemplate(name: string, title: string, reason?: string) {
  return {
    subject: `Meeting request declined: ${title}`,
    html: `<p>Hi ${name},</p><p>Your meeting request "${title}" was not approved.${reason ? ` Reason: ${reason}` : ""}</p>`,
    text: `Hi ${name}, your meeting request "${title}" was not approved.${reason ? ` Reason: ${reason}` : ""}`,
  };
}

export function meetingAlternativeProposedTemplate(name: string, title: string, altStart: Date, note?: string) {
  return {
    subject: `New time proposed: ${title}`,
    html: `<p>Hi ${name},</p><p>An alternative time was proposed for "${title}": ${fmt(altStart)}.${note ? ` Note: ${note}` : ""}</p>`,
    text: `Hi ${name}, an alternative time was proposed for "${title}": ${fmt(altStart)}.${note ? ` Note: ${note}` : ""}`,
  };
}

export function meetingCancelledTemplate(name: string, title: string) {
  return {
    subject: `Meeting cancelled: ${title}`,
    html: `<p>Hi ${name},</p><p>"${title}" has been cancelled.</p>`,
    text: `Hi ${name}, "${title}" has been cancelled.`,
  };
}

export function meetingRescheduledTemplate(name: string, title: string, newStart: Date) {
  return {
    subject: `Meeting rescheduled: ${title}`,
    html: `<p>Hi ${name},</p><p>"${title}" has been rescheduled to ${fmt(newStart)}.</p>`,
    text: `Hi ${name}, "${title}" has been rescheduled to ${fmt(newStart)}.`,
  };
}

export function newMeetingRequestAdminTemplate(requesterName: string, title: string, start: Date) {
  return {
    subject: `New meeting request: ${title}`,
    html: `<p>${requesterName} requested a meeting "${title}" for ${fmt(start)}.</p>`,
    text: `${requesterName} requested a meeting "${title}" for ${fmt(start)}.`,
  };
}
