import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-max max-w-56 -translate-x-1/2 scale-95 rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-snug text-background opacity-0 shadow-lg transition-all duration-100 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

/** A small "?" affordance for explaining a field/control that has no natural hover target of its own. */
export function HelpHint({ text }: { text: string }) {
  return (
    <Tooltip text={text}>
      <button
        type="button"
        tabIndex={0}
        aria-label={text}
        className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <HelpCircle size={14} />
      </button>
    </Tooltip>
  );
}
