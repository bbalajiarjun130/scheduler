import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CalendarEventView, EventType, MeetingRequestView } from "@scheduler/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EventFormDialog } from "@/components/calendar/EventFormDialog";
import { EventListItem } from "@/components/calendar/EventListItem";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { fetchDashboard } from "@/lib/dashboardApi";
import { useAuth } from "@/lib/auth";
import { Plus } from "lucide-react";

const quickCreateTypes: { type: EventType; label: string }[] = [
  { type: "meeting", label: "Meeting" },
  { type: "work_session", label: "Project work" },
  { type: "personal", label: "Personal" },
  { type: "social", label: "Social" },
];

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [quickCreateType, setQuickCreateType] = useState<EventType | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEventView | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", timezone],
    queryFn: () => fetchDashboard(timezone),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    setQuickCreateType(null);
    setEditingEvent(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back, {user?.name?.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's what's on your plate.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickCreateTypes.map((qc) => (
            <Button key={qc.type} size="sm" variant="secondary" onClick={() => setQuickCreateType(qc.type)}>
              <Plus size={14} /> {qc.label}
            </Button>
          ))}
          <Button size="sm" onClick={() => navigate("/calendar")}>
            Open calendar
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {data && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DashboardSection
            title="Today"
            events={data.today}
            empty="Nothing scheduled today."
            onEventClick={setEditingEvent}
          />
          <Card>
            <CardHeader>
              <CardTitle>Pending meeting requests</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.pendingMeetingRequests.length === 0 && (
                <p className="text-sm text-muted-foreground">No pending requests.</p>
              )}
              {data.pendingMeetingRequests.map((r: MeetingRequestView) => (
                <button
                  key={r.id}
                  onClick={() => navigate("/admin/requests")}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-left hover:bg-muted"
                >
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.requester.name}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </button>
              ))}
            </CardContent>
          </Card>
          <DashboardSection
            title="Upcoming meetings"
            events={data.upcomingMeetings}
            empty="No meetings in the next 30 days."
            onEventClick={setEditingEvent}
          />
          <DashboardSection
            title="Upcoming project work"
            events={data.upcomingWorkSessions}
            empty="No protected work sessions scheduled."
            onEventClick={setEditingEvent}
          />
          <DashboardSection
            title="Personal & social"
            events={data.upcomingPersonalSocial}
            empty="Nothing personal or social on the books."
            onEventClick={setEditingEvent}
          />
        </div>
      )}

      {quickCreateType && (
        <EventFormDialog
          initialRange={defaultRangeFor()}
          defaultType={quickCreateType}
          onClose={() => setQuickCreateType(null)}
          onSaved={refresh}
          key={quickCreateType}
        />
      )}
      {editingEvent && <EventFormDialog editingEvent={editingEvent} onClose={() => setEditingEvent(null)} onSaved={refresh} />}
    </div>
  );
}

function defaultRangeFor() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
}

function DashboardSection({
  title,
  events,
  empty,
  onEventClick,
}: {
  title: string;
  events: CalendarEventView[];
  empty: string;
  onEventClick?: (e: CalendarEventView) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {events.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
        {events.map((e) => (
          <EventListItem key={e.id} event={e} onClick={onEventClick ? () => onEventClick(e) : undefined} />
        ))}
      </CardContent>
    </Card>
  );
}
