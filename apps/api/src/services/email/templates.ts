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
