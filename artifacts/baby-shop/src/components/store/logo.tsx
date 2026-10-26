import { BRAND } from "@/lib/format";
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="20" fill="hsl(14 88% 55%)" />
      <circle cx="32" cy="35" r="17" fill="hsl(44 96% 74%)" />
      <circle cx="38" cy="31" r="2.6" fill="hsl(285 32% 15%)" />
      <path d="M46 34l7 2.5-7 2.5z" fill="hsl(285 32% 15%)" />
      <path d="M22 38c4 4 10 4 13 1" stroke="hsl(14 88% 55%)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M30 18c1-5 5-7 8-6-2 1-3 3-3 6" fill="hsl(285 32% 15%)" />
    </svg>
  );
}
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className={"font-display text-lg font-bold tracking-tight " + (light ? "text-background" : "text-foreground")}>{BRAND}</span>
    </span>
  );
}
