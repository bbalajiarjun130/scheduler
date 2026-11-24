import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { useDismissible } from "@/lib/useDismissible";

export function WelcomeBanner({ role }: { role: "admin" | "user" }) {
  const { dismissed, dismiss } = useDismissible("welcome-banner-v1");
  if (dismissed) return null;

  return (
    <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm">
          <p className="mb-1.5 font-medium">
            {role === "admin" ? "Welcome — here's how this works" : "Welcome! A few things to know"}
          </p>
          {role === "admin" ? (
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>
                Your <Link to="/calendar" className="underline">Calendar</Link> is the single source of truth — only
                you can edit it directly. Everyone else has to submit a request.
              </li>
              <li>
                New registrations land as <strong>pending</strong> in{" "}
                <Link to="/admin/users" className="underline">Users</Link> until you approve them.
              </li>
              <li>
                Approved users can see and request nothing by default — grant access per project or for
                general/social meetings in <Link to="/admin/permissions" className="underline">Permissions</Link>.
              </li>
              <li>
                Set working hours, buffers, and connect Google Calendar/Meet in{" "}
                <Link to="/admin/settings" className="underline">Settings</Link>.
              </li>
            </ul>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>
                Head to <Link to="/requests" className="underline">My Requests</Link> to ask for a meeting — pick a
                category, see real open times, and submit.
              </li>
              <li>
                You can only request what the administrator has specifically allowed. If a category or project is
                missing, ask them to grant access.
              </li>
              <li>
                Check <Link to="/projects" className="underline">Projects</Link> to see what you've been given
                access to.
              </li>
            </ul>
          )}
        </div>
        <button onClick={dismiss} className="flex-shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
