import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/** How admin stock money is counted: one unit of every product, or every unit in the supplier's stock. */
export type CountMode = "one" | "all";

const KEY = "ptashenya-admin-count-mode";
const listeners = new Set<() => void>();
const read = (): CountMode => (typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "all" ? "all" : "one");

export function useCountMode(): [CountMode, (m: CountMode) => void] {
  const mode = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => "one" as CountMode,
  );
  const set = (m: CountMode) => { localStorage.setItem(KEY, m); listeners.forEach((l) => l()); };
  return [mode, set];
}

const OPTIONS: { v: CountMode; l: string }[] = [
  { v: "one", l: "По 1 шт." },
  { v: "all", l: "Усі штуки" },
];

export function CountModeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useCountMode();
  return (
    <div role="radiogroup" aria-label="Як рахувати" className={cn("inline-flex shrink-0 rounded-full bg-muted p-0.5", className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={mode === o.v}
          onClick={() => setMode(o.v)}
          data-testid={`toggle-count-${o.v}`}
          className={cn("h-7 rounded-full px-3 text-xs font-bold transition", mode === o.v ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
