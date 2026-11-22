import type { EventType } from "@scheduler/shared";

export const categoryLabel: Record<EventType, string> = {
  meeting: "Meeting",
  work_session: "Project work",
  personal: "Personal",
  social: "Social",
  blocked: "Blocked",
};

export const categoryClasses: Record<EventType, { bg: string; border: string; text: string; dot: string }> = {
  meeting: { bg: "bg-category-meeting/15", border: "border-category-meeting/40", text: "text-category-meeting", dot: "bg-category-meeting" },
  work_session: { bg: "bg-category-work/15", border: "border-category-work/40", text: "text-category-work", dot: "bg-category-work" },
  personal: { bg: "bg-category-personal/15", border: "border-category-personal/40", text: "text-category-personal", dot: "bg-category-personal" },
  social: { bg: "bg-category-social/15", border: "border-category-social/40", text: "text-category-social", dot: "bg-category-social" },
  blocked: { bg: "bg-category-blocked/15", border: "border-category-blocked/40", text: "text-category-blocked", dot: "bg-category-blocked" },
};

// Resolved hex-ish HSL strings for FullCalendar, which wants real CSS color values, not utility classes.
export function categoryCssColor(type: EventType): string {
  const map: Record<EventType, string> = {
    meeting: "hsl(237 84% 60%)",
    work_session: "hsl(259 60% 55%)",
    personal: "hsl(160 50% 42%)",
    social: "hsl(25 90% 55%)",
    blocked: "hsl(220 9% 60%)",
  };
  return map[type];
}
