import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, EventContentArg, EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CalendarEventView, EventType } from "@scheduler/shared";
import { Button } from "@/components/ui/button";
import { EventFormDialog } from "@/components/calendar/EventFormDialog";
import { fetchEvents, parseOccurrenceId, updateEvent } from "@/lib/eventsApi";
import { fetchSettings } from "@/lib/settingsApi";
import { ApiRequestError } from "@/lib/apiClient";
import { categoryClasses, categoryCssColor, categoryLabel } from "@/lib/eventStyle";
import { Plus } from "lucide-react";

const allTypes: EventType[] = ["meeting", "work_session", "personal", "social", "blocked"];

export function CalendarPage() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<EventType[]>(allTypes);
  const [dialog, setDialog] = useState<
    | { mode: "create"; range: { start: Date; end: Date } }
    | { mode: "edit"; event: CalendarEventView }
    | null
  >(null);
  const [banner, setBanner] = useState<string | null>(null);
  const calendarRef = useRef<FullCalendar | null>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["events", range?.start.toISOString(), range?.end.toISOString()],
    queryFn: () => fetchEvents(range!.start, range!.end),
    enabled: Boolean(range),
  });

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  useEffect(() => {
    if (settings) calendarRef.current?.getApi().changeView(settings.defaultCalendarView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.defaultCalendarView]);

  const filtered = useMemo(() => events.filter((e) => visibleTypes.includes(e.type)), [events, visibleTypes]);

  const fcEvents = useMemo(
    () =>
      filtered.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        backgroundColor: categoryCssColor(e.type),
        borderColor: categoryCssColor(e.type),
        extendedProps: { raw: e },
      })),
    [filtered]
  );

  function refetchEvents() {
    queryClient.invalidateQueries({ queryKey: ["events"] });
    setDialog(null);
  }

  function toggleType(type: EventType) {
    setVisibleTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  function onSelect(arg: DateSelectArg) {
    setDialog({ mode: "create", range: { start: arg.start, end: arg.end } });
    calendarRef.current?.getApi().unselect();
  }

  function onEventClick(arg: EventClickArg) {
    const raw = arg.event.extendedProps.raw as CalendarEventView;
    setDialog({ mode: "edit", event: raw });
  }

  async function handleDropOrResize(arg: EventDropArg | EventResizeDoneArg) {
    const raw = arg.event.extendedProps.raw as CalendarEventView;
    const { masterId, occurrenceStart } = parseOccurrenceId(raw.id);
    const newStart = arg.event.start!;
    const newEnd = arg.event.end!;

    try {
      await updateEvent(masterId, {
        start: newStart,
        end: newEnd,
        ...(raw.isRecurring ? { scope: "instance" as const, occurrenceStart: new Date(occurrenceStart) } : {}),
      });
      refetchEvents();
    } catch (err) {
      arg.revert();
      setBanner(err instanceof ApiRequestError ? err.message : "Could not move event");
    }
  }

  return (
    <div className="flex h-full flex-col px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {allTypes.map((type) => {
              const active = visibleTypes.includes(type);
              const c = categoryClasses[type];
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity ${c.border} ${c.text} ${active ? "" : "opacity-40"}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                  {categoryLabel[type]}
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            onClick={() => {
              const now = new Date();
              const start = new Date(now.getTime() + 60 * 60 * 1000);
              start.setMinutes(0, 0, 0);
              setDialog({ mode: "create", range: { start, end: new Date(start.getTime() + 60 * 60 * 1000) } });
            }}
          >
            <Plus size={14} /> New event
          </Button>
        </div>
      </div>

      {banner && (
        <div className="mb-3 flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {banner}
          <button onClick={() => setBanner(null)} className="font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 rounded-lg border border-border bg-card p-3">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          height="auto"
          selectable
          editable
          eventResizableFromStart
          nowIndicator
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          events={fcEvents}
          datesSet={(arg) => setRange({ start: arg.start, end: arg.end })}
          select={onSelect}
          eventClick={onEventClick}
          eventDrop={handleDropOrResize}
          eventResize={handleDropOrResize}
          eventContent={renderEventContent}
        />
      </div>

      {dialog?.mode === "create" && (
        <EventFormDialog initialRange={dialog.range} onClose={() => setDialog(null)} onSaved={refetchEvents} />
      )}
      {dialog?.mode === "edit" && (
        <EventFormDialog editingEvent={dialog.event} onClose={() => setDialog(null)} onSaved={refetchEvents} />
      )}
    </div>
  );
}

function renderEventContent(arg: EventContentArg) {
  const raw = arg.event.extendedProps.raw as CalendarEventView | undefined;
  return (
    <div className="px-1 py-0.5 text-xs leading-tight">
      <p className="truncate font-medium">{arg.event.title}</p>
      {raw && <p className="truncate opacity-80">{categoryLabel[raw.type]}</p>}
    </div>
  );
}
