import type { CalendarEventView } from "@scheduler/shared";
import { categoryClasses, categoryLabel } from "@/lib/eventStyle";

export function EventListItem({ event, onClick }: { event: CalendarEventView; onClick?: () => void }) {
  const c = categoryClasses[event.type];
  const start = new Date(event.start);
  const end = new Date(event.end);

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md border ${c.border} ${c.bg} px-3 py-2 text-left transition-opacity hover:opacity-90`}
    >
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${c.dot}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{event.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {start.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} –{" "}
          {end.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      <span className={`flex-shrink-0 text-xs font-medium ${c.text}`}>{categoryLabel[event.type]}</span>
    </button>
  );
}
