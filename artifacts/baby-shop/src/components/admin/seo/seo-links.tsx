import { forwardRef, useEffect, useState } from "react";
import { Link } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { Check, Copy, Download, ExternalLink, FileText, FolderTree, Gauge, Globe2, Loader2, Pencil, Search, Sparkles, X } from "lucide-react";
import { useListAdminSeoLinks, getListAdminSeoLinksQueryKey, type ListAdminSeoLinksParams, type SeoAudit, type SeoIssue, type SeoLink, type SeoLinkKindFilter } from "@workspace/api-client-react";
import { Panel } from "@/components/admin/admin-layout";
import { Pager } from "@/components/admin/pager";
import { ProductImage } from "@/components/store/product-image";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ISSUE_META, SEVERITY_STYLE, copyText, siteBase, tools } from "./seo-meta";

const KINDS: { v: SeoLinkKindFilter; l: string; count: (a?: SeoAudit) => number | undefined }[] = [
  { v: "all", l: "Усі", count: (a) => a?.totalUrls },
  { v: "product", l: "Товари", count: (a) => a?.productPages },
  { v: "category", l: "Категорії", count: (a) => a?.categoryPages },
  { v: "page", l: "Сторінки", count: (a) => a?.staticPages },
];

function Meter({ n, max, label }: { n: number; max: number; label: string }) {
  const over = n > max, tiny = n < max * 0.4;
  return (
    <div className="flex items-center gap-1.5" title={`${label}: ${n} з ${max}`}>
      <span className="w-6 text-[10px] uppercase text-muted-foreground">{label}</span>
      <span className="h-1 w-14 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", over ? "bg-destructive" : tiny ? "bg-[hsl(36_95%_55%)]" : "bg-[hsl(152_55%_42%)]")} style={{ width: `${Math.min(100, (n / max) * 100)}%` }} /></span>
      <span className="font-mono text-[10px] tabular text-muted-foreground">{n}/{max}</span>
    </div>
  );
}

function ActionBtn({ href, onClick, title, children, testId }: { href?: string; onClick?: () => void; title: string; children: React.ReactNode; testId: string }) {
  const cls = "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-foreground/30 hover:text-foreground";
  return href
    ? <a href={href} target="_blank" rel="noreferrer" title={title} aria-label={title} className={cls} data-testid={testId}>{children}</a>
    : <button type="button" onClick={onClick} title={title} aria-label={title} className={cls} data-testid={testId}>{children}</button>;
}

function LinkRow({ l, base }: { l: SeoLink; base: string }) {
  const url = base + l.path;
  const [copied, setCopied] = useState(false);
  const key = `${l.kind}-${l.id ?? l.path}`;
  return (
    <li className="group grid gap-3 p-4 transition hover:bg-muted/30 md:grid-cols-[56px_1fr_auto]" data-testid={`seo-link-${key}`}>
      <div className="hidden md:block">
        {l.kind === "product" ? <ProductImage src={l.imageUrl} alt="" className="h-14 w-14 rounded-xl border border-card-border" />
          : <span className={cn("grid h-14 w-14 place-items-center rounded-xl", l.kind === "category" ? "bg-[hsl(275_60%_94%)] text-[hsl(275_50%_45%)]" : "bg-primary/10 text-primary")}>{l.kind === "category" ? <FolderTree className="h-6 w-6" /> : <FileText className="h-6 w-6" />}</span>}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", l.kind === "product" ? "bg-muted text-muted-foreground" : l.kind === "category" ? "bg-[hsl(275_60%_94%)] text-[hsl(275_50%_40%)]" : "bg-primary/10 text-primary")}>{l.kind === "product" ? "товар" : l.kind === "category" ? "категорія" : "сторінка"}</span>
          {l.sku && <span className="font-mono text-[10px] text-muted-foreground">код {l.sku}</span>}
          {l.issues.map((i) => { const m = ISSUE_META[i]; return <span key={i} className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold", SEVERITY_STYLE[m.severity].chip)}><m.icon className="h-3 w-3" />{m.short}</span>; })}
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-[12px] leading-snug text-[hsl(152_55%_28%)] hover:underline" data-testid={`text-link-url-${key}`}>{url}</a>
        <div className="mt-0.5 text-[15px] leading-snug text-[hsl(225_70%_42%)]">{l.title}</div>
        {l.description && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-[hsl(220_8%_35%)]">{l.description}</p>}
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1"><Meter n={l.titleLength} max={70} label="title" /><Meter n={l.descriptionLength} max={160} label="desc" /></div>
      </div>
      <div className="flex flex-wrap items-start gap-1.5 md:w-[120px] md:justify-end">
        <ActionBtn href={url} title="Відкрити сторінку" testId={`action-open-${key}`}><ExternalLink className="h-3.5 w-3.5" /></ActionBtn>
        <ActionBtn onClick={() => copyText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); })} title="Копіювати посилання" testId={`action-copy-${key}`}>{copied ? <Check className="h-3.5 w-3.5 text-[hsl(152_55%_35%)]" /> : <Copy className="h-3.5 w-3.5" />}</ActionBtn>
        <ActionBtn href={tools.googleIndex(url)} title="Чи є сторінка в Google" testId={`action-google-${key}`}><Globe2 className="h-3.5 w-3.5" /></ActionBtn>
        <ActionBtn href={tools.pageSpeed(url)} title="Швидкість (PageSpeed)" testId={`action-speed-${key}`}><Gauge className="h-3.5 w-3.5" /></ActionBtn>
        {l.kind === "product" && <ActionBtn href={tools.richResults(url)} title="Розмітка товару (Rich Results)" testId={`action-rich-${key}`}><Sparkles className="h-3.5 w-3.5" /></ActionBtn>}
        {l.kind === "product" && l.sku && <Link href={`/admin/products?q=${encodeURIComponent(l.sku)}`} title="Відкрити в товарах" aria-label="Відкрити в товарах" className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-foreground/30 hover:text-foreground" data-testid={`action-edit-${key}`}><Pencil className="h-3.5 w-3.5" /></Link>}
      </div>
    </li>
  );
}

export const SeoLinks = forwardRef<HTMLDivElement, { audit?: SeoAudit; issue: SeoIssue | null; onIssue: (i: SeoIssue | null) => void }>(function SeoLinks({ audit, issue, onIssue }, ref) {
  const { toast } = useToast();
  const [kind, setKind] = useState<SeoLinkKindFilter>("all");
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => setQ(qIn.trim()), 300); return () => clearTimeout(t); }, [qIn]);
  useEffect(() => setPage(1), [kind, q, issue]);
  useEffect(() => { if (issue && kind !== "all" && kind !== "product") setKind("product"); }, [issue, kind]);
  const params: ListAdminSeoLinksParams = { kind, issue: issue ?? undefined, q: q || undefined, page, limit: 50 };
  const { data, isLoading, isFetching, isError, refetch } = useListAdminSeoLinks(params, { query: { queryKey: getListAdminSeoLinksQueryKey(params), placeholderData: keepPreviousData } });
  const base = siteBase();
  const qs = new URLSearchParams();
  if (kind !== "all") qs.set("kind", kind);
  if (issue) qs.set("issue", issue);
  if (q) qs.set("q", q);
  const exportHref = `${import.meta.env.BASE_URL}api/admin/export/seo-links.csv${qs.toString() ? "?" + qs : ""}`;
  const copyPage = () => {
    if (!data?.items.length) return;
    copyText(data.items.map((l) => base + l.path).join("\n")).then(() => toast({ title: `Скопійовано ${data.items.length} посилань` }));
  };

  return (
    <div ref={ref} className="scroll-mt-20">
      <Panel className="mb-4 overflow-hidden" title={<span className="flex items-center gap-2">Усі посилання сайту{audit && <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] tabular">{num(audit.totalUrls)}</span>}</span>}
        action={<div className="flex items-center gap-1.5">
          <button type="button" onClick={copyPage} disabled={!data?.items.length} data-testid="button-copy-page-links" className="hidden h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 sm:inline-flex"><Copy className="h-3.5 w-3.5" />Копіювати сторінку</button>
          <a href={exportHref} download data-testid="link-export-seo-links" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-2.5 text-xs font-bold text-background"><Download className="h-3.5 w-3.5" />Excel</a>
        </div>}>
        <div className="space-y-3 border-b border-border p-3 sm:p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
              {KINDS.map((k) => (
                <button key={k.v} type="button" onClick={() => { setKind(k.v); if (k.v === "page" || k.v === "category") onIssue(null); }} data-testid={`tab-kind-${k.v}`}
                  className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition", kind === k.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {k.l}{k.count(audit) != null && <span className="font-mono text-[10px] tabular text-muted-foreground">{num(k.count(audit)!)}</span>}
                </button>
              ))}
            </div>
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={qIn} onChange={(e) => setQIn(e.target.value)} placeholder="Пошук за назвою, кодом або посиланням" data-testid="input-seo-links-search" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-9 text-sm outline-none focus:border-primary" />
              {isFetching && !isLoading ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : qIn && <button type="button" onClick={() => setQIn("")} aria-label="Очистити" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}
            </label>
          </div>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            <button type="button" onClick={() => onIssue(null)} data-testid="chip-issue-none" className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition", !issue ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40")}>Без фільтра</button>
            {(audit?.issues ?? []).filter((x) => x.count > 0 || x.issue === issue).map((x) => {
              const m = ISSUE_META[x.issue];
              return (
                <button key={x.issue} type="button" onClick={() => onIssue(issue === x.issue ? null : x.issue)} data-testid={`chip-issue-${x.issue}`}
                  className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition", issue === x.issue ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground/40")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", issue === x.issue ? "bg-primary-foreground" : SEVERITY_STYLE[m.severity].dot)} />{m.label}<span className="font-mono text-[10px] tabular opacity-70">{num(x.count)}</span>
                </button>
              );
            })}
          </div>
        </div>
        {isError ? (
          <div className="p-10 text-center"><p className="font-semibold">Не вдалося завантажити посилання</p><button type="button" onClick={() => refetch()} className="mt-3 rounded-lg bg-foreground px-4 py-2 text-sm text-background" data-testid="button-retry-links">Спробувати знову</button></div>
        ) : isLoading || !data ? (
          <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : data.items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground" data-testid="text-links-empty">{issue ? "Таких проблем немає — чудово!" : "Нічого не знайдено."}</div>
        ) : (
          <ul className={cn("divide-y divide-border transition-opacity", isFetching && "opacity-60")}>{data.items.map((l) => <LinkRow key={`${l.kind}-${l.id ?? l.path}`} l={l} base={base} />)}</ul>
        )}
        {data && data.total > 0 && <Pager page={data.page} pages={data.pages} total={data.total} onPage={(p) => { setPage(p); (ref as React.RefObject<HTMLDivElement | null>)?.current?.scrollIntoView({ behavior: "smooth" }); }} />}
      </Panel>
    </div>
  );
});
