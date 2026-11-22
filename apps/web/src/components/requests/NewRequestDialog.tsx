import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MeetingCategory, MeetingFormat } from "@scheduler/shared";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError } from "@/lib/apiClient";
import { createMeetingRequest, fetchAvailability } from "@/lib/meetingRequestsApi";
import { fetchMyProjects } from "@/lib/projectsApi";
import { fetchPublicSettings } from "@/lib/settingsApi";

export function NewRequestDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: publicSettings } = useQuery({ queryKey: ["settings", "public"], queryFn: fetchPublicSettings });
  const durationOptions = publicSettings?.availableDurations ?? [30];

  const [category, setCategory] = useState<MeetingCategory>("general");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<MeetingFormat>("online");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState(30);
  const [rangeFrom, setRangeFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [rangeTo, setRangeTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (publicSettings && !publicSettings.availableDurations.includes(duration)) {
      setDuration(publicSettings.availableDurations[0] ?? 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicSettings]);

  const { data: projects = [] } = useQuery({
    queryKey: ["my-projects"],
    queryFn: fetchMyProjects,
    enabled: category === "project",
  });

  const {
    data: slots = [],
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["availability", rangeFrom, rangeTo, duration, category, projectId],
    queryFn: () => fetchAvailability(new Date(rangeFrom), new Date(rangeTo), duration, category, projectId || undefined),
    enabled: false,
  });

  async function handleFindTimes() {
    setSlotsLoaded(true);
    setSelectedSlot(null);
    setError(null);
    const result = await refetch();
    if (result.error) {
      setError(result.error instanceof ApiRequestError ? result.error.message : "Could not load availability");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) {
      setError("Pick an available time first.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createMeetingRequest({
        category,
        projectId: category === "project" ? projectId : undefined,
        title,
        description: description || undefined,
        start: new Date(selectedSlot.start),
        durationMinutes: duration,
        format,
        location: location || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const slotsByDay = slots.reduce<Record<string, typeof slots>>((acc, slot) => {
    const day = new Date(slot.start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    acc[day] = acc[day] ?? [];
    acc[day].push(slot);
    return acc;
  }, {});

  return (
    <Modal title="Request a meeting" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as MeetingCategory)}>
              <option value="general">General</option>
              <option value="project">Project</option>
              <option value="social">Social</option>
            </Select>
          </div>
          {category === "project" && (
            <div className="flex flex-col gap-1.5">
              <Label>Project</Label>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
                <option value="">Select a project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Description (optional)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Format</Label>
            <Select value={format} onChange={(e) => setFormat(e.target.value as MeetingFormat)}>
              <option value="online">Online</option>
              <option value="in_person">In person</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Duration</Label>
            <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {durationOptions.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </Select>
          </div>
        </div>

        {format === "in_person" && (
          <div className="flex flex-col gap-1.5">
            <Label>Suggested location (optional)</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        )}

        <div className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-end justify-between gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
              </div>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={handleFindTimes} disabled={isFetching}>
              {isFetching ? "Searching..." : "Find times"}
            </Button>
          </div>

          {slotsLoaded && !isFetching && slots.length === 0 && (
            <p className="text-sm text-muted-foreground">No open times in that range.</p>
          )}

          {Object.entries(slotsByDay).length > 0 && (
            <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
              {Object.entries(slotsByDay).map(([day, daySlots]) => (
                <div key={day}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{day}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {daySlots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-md border px-2 py-1 text-xs ${
                          selectedSlot?.start === slot.start
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {new Date(slot.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit request"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
