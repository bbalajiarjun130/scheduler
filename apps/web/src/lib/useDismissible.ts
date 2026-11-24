import { useEffect, useState } from "react";

/** Tracks a one-time dismissible UI element (e.g. a first-time welcome banner) per browser. */
export function useDismissible(key: string) {
  const storageKey = `scheduler.dismissed.${key}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }

  return { dismissed, dismiss };
}
