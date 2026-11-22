import { DateTime } from "luxon";
import { listOccurrencesInRange } from "./calendarService.js";

export interface ProjectHours {
  totalScheduledHours: number;
  totalCompletedHours: number;
}

/**
 * Sums work-session hours for a project over a bounded window (2 years back, 1 year
 * forward). Open-ended recurring sessions are infinite, so an unbounded sum isn't
 * meaningful anyway — this window is a practical proxy for "hours dedicated so far
 * and committed in the near future."
 */
export async function getProjectHours(projectId: string): Promise<ProjectHours> {
  const now = DateTime.now();
  const rangeStart = now.minus({ years: 2 }).toJSDate();
  const rangeEnd = now.plus({ years: 1 }).toJSDate();

  const occurrences = await listOccurrencesInRange(rangeStart, rangeEnd);
  const projectSessions = occurrences.filter((o) => o.type === "work_session" && o.projectId === projectId);

  let totalScheduledHours = 0;
  let totalCompletedHours = 0;

  for (const occ of projectSessions) {
    if (occ.status === "cancelled") continue;
    const scheduledHours = (occ.end.getTime() - occ.start.getTime()) / (1000 * 60 * 60);
    totalScheduledHours += scheduledHours;
    if (occ.status === "completed") {
      // completedHours lets the admin log actual time worked instead of the scheduled duration.
      totalCompletedHours += occ.completedHours ?? scheduledHours;
    }
  }

  return {
    totalScheduledHours: Math.round(totalScheduledHours * 100) / 100,
    totalCompletedHours: Math.round(totalCompletedHours * 100) / 100,
  };
}
