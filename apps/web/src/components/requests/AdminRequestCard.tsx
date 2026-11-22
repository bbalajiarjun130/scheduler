import { useState } from "react";
import { DateTime } from "luxon";
import type { MeetingRequestView } from "@scheduler/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "./StatusBadge";
import { approveMeetingRequest, proposeAlternative, rejectMeetingRequest, setAdminNotes } from "@/lib/meetingRequestsApi";
import { ApiRequestError } from "@/lib/apiClient";

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
function toLocalInput(iso: string) {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(tz).toFormat("yyyy-MM-dd'T'HH:mm");
}
function localToUtc(value: string) {
  return DateTime.fromISO(value, { zone: tz }).toUTC().toJSDate();
}

export function AdminRequestCard({ request, onChanged }: { request: MeetingRequestView; onChanged: () => void }) {
  const [modifying, setModifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [notes, setNotes] = useState(request.adminNotes ?? "");
  const [reason, setReason] = useState("");
  const [altStart, setAltStart] = useState(toLocalInput(request.start));
  const [modStart, setModStart] = useState(toLocalInput(request.start));
  const [modEnd, setModEnd] = useState(toLocalInput(request.end));
  const [modFormat, setModFormat] = useState(request.format);
  const [modLocation, setModLocation] = useState(request.location ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);

  const canDecide = request.status === "pending" || request.status === "alternative_proposed";

  async function handleApprove(overrideConflicts = false) {
    setBusy(true);
    setError(null);
    setConflict(false);
    try {
      await approveMeetingRequest(request.id, {
        ...(modifying
          ? { start: localToUtc(modStart), end: localToUtc(modEnd), format: modFormat, location: modLocation || undefined }
          : {}),
        overrideConflicts,
      });
      onChanged();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        setConflict(true);
        setError("This time conflicts with an existing event.");
      } else {
        setError(err instanceof ApiRequestError ? err.message : "Could not approve");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    setError(null);
    try {
      await rejectMeetingRequest(request.id, reason || undefined);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not reject");
    } finally {
      setBusy(false);
    }
  }

  async function handlePropose() {
    setBusy(true);
    setError(null);
    try {
      const start = localToUtc(altStart);
      const end = new Date(start.getTime() + request.durationMinutes * 60 * 1000);
      await proposeAlternative(request.id, { start, end });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not propose a new time");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveNotes() {
    setBusy(true);
    try {
      await setAdminNotes(request.id, notes);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">{request.title}</p>
            <p className="text-xs text-muted-foreground">
              {request.requester.name} ({request.requester.email}) · {request.category}
              {request.projectName ? ` · ${request.projectName}` : ""} · {request.durationMinutes} min ·{" "}
              {request.format === "online" ? "Online" : "In person"}
            </p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <p className="text-sm">
          Requested: {new Date(request.start).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
        {request.description && <p className="text-sm text-muted-foreground">{request.description}</p>}

        {canDecide && (
          <>
            {modifying && (
              <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Start</Label>
                  <Input type="datetime-local" value={modStart} onChange={(e) => setModStart(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">End</Label>
                  <Input type="datetime-local" value={modEnd} onChange={(e) => setModEnd(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Format</Label>
                  <Select value={modFormat} onChange={(e) => setModFormat(e.target.value as typeof modFormat)}>
                    <option value="online">Online</option>
                    <option value="in_person">In person</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Location</Label>
                  <Input value={modLocation} onChange={(e) => setModLocation(e.target.value)} />
                </div>
              </div>
            )}

            {proposing && (
              <div className="flex items-end gap-2 rounded-md bg-muted p-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Alternative start</Label>
                  <Input type="datetime-local" value={altStart} onChange={(e) => setAltStart(e.target.value)} />
                </div>
                <Button size="sm" onClick={handlePropose} disabled={busy}>
                  Send
                </Button>
              </div>
            )}

            {rejecting && (
              <div className="flex items-end gap-2 rounded-md bg-muted p-2">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs">Reason (optional)</Label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <Button size="sm" variant="destructive" onClick={handleReject} disabled={busy}>
                  Confirm reject
                </Button>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600">
                <p>{error}</p>
                {conflict && (
                  <Button size="sm" variant="destructive" className="mt-1" onClick={() => handleApprove(true)}>
                    Approve anyway
                  </Button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleApprove(false)} disabled={busy}>
                Approve{modifying ? " with changes" : ""}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setModifying((v) => !v)}>
                {modifying ? "Cancel changes" : "Modify time/format"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setProposing((v) => !v)}>
                Propose alternative
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setRejecting((v) => !v)}>
                Reject
              </Button>
            </div>
          </>
        )}

        <div className="flex items-end gap-2 border-t border-border pt-2">
          <div className="flex flex-1 flex-col gap-1">
            <Label className="text-xs">Private admin notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
          </div>
          <Button size="sm" variant="secondary" onClick={handleSaveNotes} disabled={busy}>
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
