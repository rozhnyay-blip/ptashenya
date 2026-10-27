import { ArrowRight, Boxes, CheckCircle2, FolderTree, Link2, Loader2, Package, Zap } from "lucide-react";
import type { SeoAudit, SeoBucket, SeoIssue } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTime, num, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ISSUE_META, SEVERITY_STYLE } from "./seo-meta";

function grade(score: number) {
  if (score >= 90) return { label: "Відмінно", color: "hsl(152 60% 52%)" };
  if (score >= 75) return { label: "Добре", color: "hsl(84 60% 52%)" };
  if (score >= 50) return { label: "Потребує уваги", color: "hsl(36 95% 58%)" };
  return { label: "Погано", color: "hsl(4 85% 60%)" };
}

function ScoreRing({ score }: { score: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const g = grade(score);
  return (
    <div className="relative h-36 w-36 shrink-0" data-testid="seo-score">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-sidebar-accent" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={g.color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-[stroke-dashoffset] duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-mono text-4xl font-semibold leading-none tabular" data-testid="text-seo-score">{score}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: g.color }}>{g.label}</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, testId }: { icon: typeof Link2; label: string; value: number; testId: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-sidebar-accent/50 p-3 ring-1 ring-inset ring-sidebar-border">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/55"><Icon className="h-3 w-3 shrink-0" /><span className="truncate">{label}</span></div>
      <div className="mt-1 font-mono text-xl font-semibold tabular sm:text-2xl" data-testid={testId}>{num(value)}</div>
    </div>
  );
}

export function SeoHero({ audit, coverage, withSeo, inStock, lastRunAt, lastRunCount, running, elapsed, result, onRun }: {
  audit?: SeoAudit; coverage: number; withSeo: number; inStock: number; lastRunAt: string | null; lastRunCount: number | null;
  running: boolean; elapsed: number; result: { updated: number; durationMs: number } | null; onRun: () => void;
}) {
  return (
    <section className="relative mb-4 overflow-hidden rounded-3xl bg-sidebar p-5 text-sidebar-foreground sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-[hsl(152_60%_45%/.18)] blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[.07] [background-image:linear-gradient(hsl(0_0%_100%)_1px,transparent_1px),linear-gradient(90deg,hsl(0_0%_100%)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative grid gap-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="flex items-center gap-5">
          {audit ? <ScoreRing score={audit.score} /> : <Skeleton className="h-36 w-36 rounded-full bg-sidebar-accent" />}
          <div className="min-w-0 lg:hidden"><HeroCoverage coverage={coverage} withSeo={withSeo} inStock={inStock} lastRunAt={lastRunAt} lastRunCount={lastRunCount} /></div>
        </div>
        <div className="min-w-0 space-y-4">
          <div className="hidden lg:block"><HeroCoverage coverage={coverage} withSeo={withSeo} inStock={inStock} lastRunAt={lastRunAt} lastRunCount={lastRunCount} /></div>
          {audit ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat icon={Link2} label="Усього посилань" value={audit.totalUrls} testId="stat-total-urls" />
              <Stat icon={Package} label="Товарів" value={audit.productPages} testId="stat-product-pages" />
              <Stat icon={FolderTree} label="Категорій" value={audit.categoryPages} testId="stat-category-pages" />
              <Stat icon={Boxes} label="Під замовлення" value={audit.onOrderProducts} testId="stat-on-order" />
            </div>
          ) : <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] rounded-xl bg-sidebar-accent" />)}</div>}
        </div>
        <div className="flex flex-col items-stretch gap-2 lg:w-60">
          <button type="button" onClick={onRun} disabled={running} data-testid="button-run-seo" className="group relative inline-flex h-14 items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-primary px-6 text-base font-bold text-primary-foreground shadow-[0_14px_34px_-12px_hsl(14_88%_55%/0.9)] transition hover:-translate-y-0.5 active:translate-y-0 disabled:translate-y-0 disabled:opacity-90">
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            {running ? <><Loader2 className="h-5 w-5 animate-spin" />Оновлюю… <span className="font-mono tabular">{elapsed.toFixed(1)} с</span></> : <><Zap className="h-5 w-5 transition group-hover:rotate-12" />Оновити SEO</>}
          </button>
          {result ? <div className="flex items-center justify-center gap-1.5 text-sm text-[hsl(160_55%_75%)]" data-testid="text-seo-result"><CheckCircle2 className="h-4 w-4" />{num(result.updated)} товарів за {(result.durationMs / 1000).toFixed(1)} с</div>
            : !running && <div className="text-center text-[11px] text-sidebar-foreground/50">5–10 секунд для всього каталогу</div>}
        </div>
      </div>
    </section>
  );
}

function HeroCoverage({ coverage, withSeo, inStock, lastRunAt, lastRunCount }: { coverage: number; withSeo: number; inStock: number; lastRunAt: string | null; lastRunCount: number | null }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/55">Здоровʼя SEO · покриття товарів</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 font-mono tabular">
        <span className="text-3xl font-semibold" data-testid="text-seo-coverage">{coverage.toFixed(1)}%</span>
        <span className="text-sm text-sidebar-foreground/65">{num(withSeo)} з {num(inStock)}</span>
      </div>
      <div className="mt-2 h-1.5 max-w-md overflow-hidden rounded-full bg-sidebar-accent"><div className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(36_95%_60%)] transition-[width] duration-700" style={{ width: `${Math.min(100, coverage)}%` }} /></div>
      <div className="mt-2 text-xs text-sidebar-foreground/60" data-testid="text-seo-last-run">{lastRunAt ? <>Оновлено {relTime(lastRunAt)} · {dateTime(lastRunAt)} · {num(lastRunCount ?? 0)} товарів</> : "Ще не запускалось"}</div>
    </div>
  );
}

function Histogram({ title, avg, ideal, buckets }: { title: string; avg: number; ideal: string; buckets: SeoBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0) || 1;
  const goodShare = (buckets.filter((b) => b.good).reduce((s, b) => s + b.count, 0) / total) * 100;
  return (
    <div className="min-w-0 rounded-2xl border border-card-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</div><div className="mt-0.5 text-[11px] text-muted-foreground">Ідеал: {ideal}</div></div>
        <div className="text-right"><div className="font-mono text-xl font-semibold tabular">{avg}</div><div className="text-[10px] text-muted-foreground">сер. символів</div></div>
      </div>
      <div className="mt-3 flex h-20 items-end gap-2">
        {buckets.map((b) => (
          <div key={b.label} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${b.label}: ${num(b.count)}`}>
            <div className={cn("w-full rounded-t-md transition-[height] duration-700", b.good ? "bg-[hsl(152_55%_45%)]" : "bg-muted-foreground/25")} style={{ height: `${Math.max(3, (b.count / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">{buckets.map((b) => <div key={b.label} className="min-w-0 flex-1 text-center"><div className="truncate text-[10px] text-muted-foreground">{b.label}</div><div className="font-mono text-[11px] font-semibold tabular">{num(b.count)}</div></div>)}</div>
      <div className="mt-2 text-[11px] text-muted-foreground"><b className="text-[hsl(152_55%_32%)]">{goodShare.toFixed(1)}%</b> у гарному діапазоні</div>
    </div>
  );
}

export function SeoMetrics({ audit, activeIssue, onPick }: { audit?: SeoAudit; activeIssue: SeoIssue | null; onPick: (i: SeoIssue) => void }) {
  if (!audit) return <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>;
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-baseline justify-between gap-2"><h2 className="font-display text-lg font-bold">Метрики</h2><span className="text-xs text-muted-foreground">Натисніть картку — покажемо ці посилання</span></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {audit.issues.map((x) => {
          const m = ISSUE_META[x.issue];
          const st = SEVERITY_STYLE[m.severity];
          const share = audit.productPages ? (x.count / audit.productPages) * 100 : 0;
          const ok = x.count === 0;
          return (
            <button key={x.issue} type="button" onClick={() => onPick(x.issue)} disabled={ok} data-testid={`metric-${x.issue}`}
              className={cn("group min-w-0 rounded-2xl border bg-card p-4 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_14px_30px_-18px_hsl(285_40%_20%/.45)]",
                activeIssue === x.issue ? "border-primary ring-2 ring-primary/25" : "border-card-border")}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("grid h-8 w-8 place-items-center rounded-xl", ok ? "bg-[hsl(152_50%_92%)] text-[hsl(152_55%_30%)]" : st.chip)}>{ok ? <CheckCircle2 className="h-4 w-4" /> : <m.icon className="h-4 w-4" />}</span>
                {!ok && <span className={cn("h-2 w-2 rounded-full", st.dot)} />}
              </div>
              <div className="mt-3 truncate text-xs font-bold">{m.label}</div>
              <div className="mt-0.5 flex items-baseline gap-1.5"><span className={cn("font-mono text-2xl font-semibold tabular", ok ? "text-[hsl(152_55%_32%)]" : "")}>{num(x.count)}</span><span className="font-mono text-[11px] text-muted-foreground tabular">{share.toFixed(1)}%</span></div>
              <div className="mt-1 line-clamp-2 min-h-[2.4em] text-[11px] leading-snug text-muted-foreground">{x.groups != null && x.count > 0 ? `${num(x.groups)} різних заголовків повторюються. ` : ""}{ok ? "Все гаразд" : m.hint}</div>
              {!ok && <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">Показати<ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></div>}
            </button>
          );
        })}
        <div className="min-w-0 rounded-2xl border border-[hsl(152_45%_80%)] bg-[hsl(152_50%_96%)] p-4" data-testid="metric-clean">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[hsl(152_50%_88%)] text-[hsl(152_55%_28%)]"><CheckCircle2 className="h-4 w-4" /></span>
          <div className="mt-3 truncate text-xs font-bold">Без зауважень</div>
          <div className="mt-0.5 flex items-baseline gap-1.5"><span className="font-mono text-2xl font-semibold text-[hsl(152_55%_28%)] tabular">{num(audit.cleanProducts)}</span><span className="font-mono text-[11px] text-muted-foreground tabular">{(audit.productPages ? (audit.cleanProducts / audit.productPages) * 100 : 0).toFixed(1)}%</span></div>
          <div className="mt-1 text-[11px] leading-snug text-muted-foreground">Сторінки товарів, де все ідеально.</div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Histogram title="Довжина заголовків" avg={audit.avgTitleLength} ideal="30–70 символів" buckets={audit.titleBuckets} />
        <Histogram title="Довжина описів" avg={audit.avgDescriptionLength} ideal="70–160 символів" buckets={audit.descriptionBuckets} />
      </div>
    </section>
  );
}
