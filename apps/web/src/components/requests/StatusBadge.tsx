import type { MeetingRequestView } from "@scheduler/shared";

const statusClasses: Record<MeetingRequestView["status"], string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  alternative_proposed: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-muted text-muted-foreground",
};

const statusLabels: Record<MeetingRequestView["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  alternative_proposed: "Alternative proposed",
  cancelled: "Cancelled",
  completed: "Completed",
};

export function StatusBadge({ status }: { status: MeetingRequestView["status"] }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
