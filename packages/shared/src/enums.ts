export const UserRole = {
  ADMIN: "admin",
  USER: "user",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
  DEACTIVATED: "deactivated",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const EventType = {
  MEETING: "meeting",
  WORK_SESSION: "work_session",
  PERSONAL: "personal",
  SOCIAL: "social",
  BLOCKED: "blocked",
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

export const EventSource = {
  MANUAL: "manual",
  MEETING_APPROVAL: "meeting_approval",
  GOOGLE_SYNC: "google_sync",
} as const;
export type EventSource = (typeof EventSource)[keyof typeof EventSource];

export const EventStatus = {
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const MeetingCategory = {
  PROJECT: "project",
  GENERAL: "general",
  SOCIAL: "social",
} as const;
export type MeetingCategory = (typeof MeetingCategory)[keyof typeof MeetingCategory];

export const MeetingFormat = {
  ONLINE: "online",
  IN_PERSON: "in_person",
} as const;
export type MeetingFormat = (typeof MeetingFormat)[keyof typeof MeetingFormat];

export const MeetingStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  ALTERNATIVE_PROPOSED: "alternative_proposed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
} as const;
export type MeetingStatus = (typeof MeetingStatus)[keyof typeof MeetingStatus];
