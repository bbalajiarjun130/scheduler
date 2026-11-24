import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SettingsView } from "@scheduler/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { HelpHint } from "@/components/ui/tooltip";
import { fetchSettings, updateSettings } from "@/lib/settingsApi";

const weekdays = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const durationCatalog = [15, 30, 45, 60, 90, 120];

export function SchedulingSettingsForm() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [form, setForm] = useState<SettingsView | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  async function handleSave() {
    if (!form) return;
    const updated = await updateSettings(form);
    setForm(updated);
    queryClient.setQueryData(["settings"], updated);
    queryClient.invalidateQueries({ queryKey: ["settings", "public"] });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function toggleWeekday(value: number) {
    if (!form) return;
    const next = form.workingDays.includes(value)
      ? form.workingDays.filter((d) => d !== value)
      : [...form.workingDays, value].sort();
    setForm({ ...form, workingDays: next });
  }

  function toggleDuration(value: number) {
    if (!form) return;
    const next = form.availableDurations.includes(value)
      ? form.availableDurations.filter((d) => d !== value)
      : [...form.availableDurations, value].sort((a, b) => a - b);
    setForm({ ...form, availableDurations: next });
  }

  if (isLoading || !form) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Scheduling Defaults</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div>
          <Label className="mb-1.5 block">Working days</Label>
          <div className="flex gap-1.5">
            {weekdays.map((d) => (
              <button
                key={d.value}
                onClick={() => toggleWeekday(d.value)}
                className={`rounded-md border px-2.5 py-1.5 text-xs ${
                  form.workingDays.includes(d.value)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label>Working hours start</Label>
            <Input type="time" value={form.workingHoursStart} onChange={(e) => setForm({ ...form, workingHoursStart: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Working hours end</Label>
            <Input type="time" value={form.workingHoursEnd} onChange={(e) => setForm({ ...form, workingHoursEnd: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Timezone</Label>
            <Input value={form.defaultTimezone} onChange={(e) => setForm({ ...form, defaultTimezone: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              Buffer (min)
              <HelpHint text="Minimum gap enforced before and after every event — nothing can be booked within this many minutes of an existing one" />
            </Label>
            <Input
              type="number"
              min={0}
              value={form.bufferMinutes}
              onChange={(e) => setForm({ ...form, bufferMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              Min notice (hrs)
              <HelpHint text="How far in advance a meeting must be requested — e.g. 24 means no one can request a slot less than a day out" />
            </Label>
            <Input
              type="number"
              min={0}
              value={form.minNoticeHours}
              onChange={(e) => setForm({ ...form, minNoticeHours: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              Max advance (days)
              <HelpHint text="How far into the future someone can book — e.g. 60 means requests can't be made more than two months out" />
            </Label>
            <Input
              type="number"
              min={1}
              value={form.maxAdvanceDays}
              onChange={(e) => setForm({ ...form, maxAdvanceDays: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              Reminder lead time (min)
              <HelpHint text="How long before a meeting starts the requester gets a reminder notification/email" />
            </Label>
            <Input
              type="number"
              min={0}
              value={form.reminderMinutesBefore}
              onChange={(e) => setForm({ ...form, reminderMinutesBefore: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Default format</Label>
            <Select
              value={form.defaultMeetingFormat}
              onChange={(e) => setForm({ ...form, defaultMeetingFormat: e.target.value as SettingsView["defaultMeetingFormat"] })}
            >
              <option value="online">Online</option>
              <option value="in_person">In person</option>
            </Select>
          </div>
        </div>

        <div>
          <Label className="mb-1.5 flex items-center gap-1.5">
            Available meeting durations
            <HelpHint text="The platform-wide default duration choices. A specific user's allowed durations (set in Permissions) override this if non-empty." />
          </Label>
          <div className="flex flex-wrap gap-2">
            {durationCatalog.map((d) => (
              <button
                key={d}
                onClick={() => toggleDuration(d)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  form.availableDurations.includes(d)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Default calendar view</Label>
          <Select
            value={form.defaultCalendarView}
            onChange={(e) => setForm({ ...form, defaultCalendarView: e.target.value as SettingsView["defaultCalendarView"] })}
            className="max-w-xs"
          >
            <option value="dayGridMonth">Month</option>
            <option value="timeGridWeek">Week</option>
            <option value="timeGridDay">Day</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.socialSchedulingEnabled}
              onChange={(e) => setForm({ ...form, socialSchedulingEnabled: e.target.checked })}
            />
            Social scheduling enabled platform-wide
            <HelpHint text="A kill switch on top of per-user permissions: if off, nobody can request social meetups even if you've granted them that permission individually" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.notifyEmailOnNewRegistration}
              onChange={(e) => setForm({ ...form, notifyEmailOnNewRegistration: e.target.checked })}
            />
            Email me on new registrations
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.notifyEmailOnMeetingRequest}
              onChange={(e) => setForm({ ...form, notifyEmailOnMeetingRequest: e.target.checked })}
            />
            Email me on new meeting requests
          </label>
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-4">
          <Button onClick={handleSave}>Save settings</Button>
          {saved && <span className="text-xs text-emerald-600">Saved</span>}
        </div>
      </CardContent>
    </Card>
  );
}
