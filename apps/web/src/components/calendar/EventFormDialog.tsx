import { useState } from "react";
import { DateTime } from "luxon";
import type { CalendarEventView, EventType } from "@scheduler/shared";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError } from "@/lib/apiClient";
import { createEvent, deleteEvent, parseOccurrenceId, updateEvent } from "@/lib/eventsApi";
import { categoryLabel } from "@/lib/eventStyle";

const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const recurrencePresets = [
  { value: "", label: "Does not repeat" },
  { value: "FREQ=DAILY", label: "Daily" },
  { value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", label: "Every weekday" },
  { value: "FREQ=WEEKLY", label: "Weekly" },
  { value: "FREQ=WEEKLY;INTERVAL=2", label: "Every 2 weeks" },
  { value: "FREQ=MONTHLY", label: "Monthly" },
];

function toLocalInputValue(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(timezone).toFormat("yyyy-MM-dd'T'HH:mm");
}

function localInputToUtc(value: string, timezone: string): Date {
  return DateTime.fromISO(value, { zone: timezone }).toUTC().toJSDate();
}

interface Props {
  initialRange?: { start: Date; end: Date };
  defaultType?: EventType;
  editingEvent?: CalendarEventView;
  onClose: () => void;
  onSaved: () => void;
}

export function EventFormDialog({ initialRange, defaultType, editingEvent, onClose, onSaved }: Props) {
  const isEditing = Boolean(editingEvent);
  const timezone = editingEvent?.timezone ?? detectedTimezone;

  const [type, setType] = useState<EventType>(editingEvent?.type ?? defaultType ?? "meeting");
  const [title, setTitle] = useState(editingEvent?.title ?? "");
  const [description, setDescription] = useState(editingEvent?.description ?? "");
  const [location, setLocation] = useState(editingEvent?.location ?? "");
  const [isPrivate, setIsPrivate] = useState(editingEvent?.isPrivate ?? type !== "meeting");
  const [startLocal, setStartLocal] = useState(
    editingEvent ? toLocalInputValue(editingEvent.start, timezone) : DateTime.fromJSDate(initialRange!.start).toFormat("yyyy-MM-dd'T'HH:mm")
  );
  const [endLocal, setEndLocal] = useState(
    editingEvent ? toLocalInputValue(editingEvent.end, timezone) : DateTime.fromJSDate(initialRange!.end).toFormat("yyyy-MM-dd'T'HH:mm")
  );
  const [recurrence, setRecurrence] = useState("");
  const [recurrenceCount, setRecurrenceCount] = useState("");
  const [scope, setScope] = useState<"instance" | "all">("instance");
  const [error, setError] = useState<string | null>(null);
  const [conflictInfo, setConflictInfo] = useState<CalendarEventView[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(overrideConflicts = false) {
    setError(null);
    setConflictInfo(null);
    setSubmitting(true);
    try {
      const start = localInputToUtc(startLocal, timezone);
      const end = localInputToUtc(endLocal, timezone);

      if (isEditing && editingEvent) {
        const { masterId, occurrenceStart } = parseOccurrenceId(editingEvent.id);
        const isRecurring = editingEvent.isRecurring;
        await updateEvent(masterId, {
          title,
          description,
          location,
          isPrivate,
          timezone,
          overrideConflicts,
          ...(isRecurring
            ? { scope, occurrenceStart: new Date(occurrenceStart), ...(scope === "instance" ? { start, end } : {}) }
            : { start, end }),
        });
      } else {
        let recurrenceRule = recurrence || undefined;
        if (recurrenceRule && recurrenceCount) {
          recurrenceRule = `${recurrenceRule};COUNT=${recurrenceCount}`;
        }
        await createEvent({
          type,
          title,
          description,
          location,
          isPrivate,
          start,
          end,
          timezone,
          recurrenceRule,
          overrideConflicts,
        });
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        const details = err.details as { conflictingEvents?: CalendarEventView[] } | undefined;
        setConflictInfo(details?.conflictingEvents ?? []);
        setError("This time conflicts with an existing event.");
      } else {
        setError(err instanceof ApiRequestError ? err.message : "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editingEvent) return;
    setSubmitting(true);
    try {
      const { masterId, occurrenceStart } = parseOccurrenceId(editingEvent.id);
      await deleteEvent(masterId, editingEvent.isRecurring ? { scope, occurrenceStart } : undefined);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEditing ? "Edit event" : "New event"} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave(false);
        }}
      >
        {isEditing && editingEvent?.isRecurring && (
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <p className="mb-2 font-medium">This is part of a recurring series</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" checked={scope === "instance"} onChange={() => setScope("instance")} />
                This occurrence
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" checked={scope === "all"} onChange={() => setScope("all")} />
                Whole series
              </label>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as EventType)} disabled={isEditing}>
            {Object.entries(categoryLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        {(!isEditing || scope === "instance") && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Start ({timezone})</Label>
              <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>End ({timezone})</Label>
              <Input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} required />
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Repeats</Label>
              <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                {recurrencePresets.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            {recurrence && (
              <div className="flex flex-col gap-1.5">
                <Label>End after N occurrences (optional)</Label>
                <Input
                  type="number"
                  min={1}
                  value={recurrenceCount}
                  onChange={(e) => setRecurrenceCount(e.target.value)}
                  placeholder="No end date"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>Location (optional)</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Online, office, address..." />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          Private (details hidden from collaborators)
        </label>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            <p>{error}</p>
            {conflictInfo && conflictInfo.length > 0 && (
              <ul className="mt-1 list-inside list-disc">
                {conflictInfo.map((c) => (
                  <li key={c.id}>
                    {c.title} ({new Date(c.start).toLocaleString()})
                  </li>
                ))}
              </ul>
            )}
            {conflictInfo && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="mt-2"
                onClick={() => handleSave(true)}
                disabled={submitting}
              >
                Save anyway
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {isEditing ? (
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={submitting}>
              {editingEvent?.isRecurring && scope === "instance" ? "Cancel this occurrence" : "Delete"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
