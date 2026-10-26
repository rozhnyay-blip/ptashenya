import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductImage({ src, alt, className, imgClassName }: { src: string | null | undefined; alt: string; className?: string; imgClassName?: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const show = src && !failed;
  return (
    <div className={cn("relative overflow-hidden bg-[hsl(40_60%_96%)]", className)}>
      {show ? (
        <>
          {!loaded && <div className="absolute inset-0 animate-pulse bg-muted" />}
          <img src={src} alt={alt} loading="lazy" onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
            className={cn("h-full w-full object-contain p-3 mix-blend-multiply transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", imgClassName)} />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_30%,hsl(44_96%_86%),hsl(36_60%_94%)_60%)]">
          <svg viewBox="0 0 64 64" className="h-1/3 w-1/3 opacity-70" aria-hidden>
            <circle cx="32" cy="36" r="16" fill="hsl(44 96% 74%)" />
            <circle cx="37" cy="32" r="2.4" fill="hsl(285 32% 15%)" />
            <path d="M45 35l6 2-6 2z" fill="hsl(14 88% 55%)" />
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">фото скоро</span>
        </div>
      )}
    </div>
  );
}
