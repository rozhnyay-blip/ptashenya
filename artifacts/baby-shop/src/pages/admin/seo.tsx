import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Globe, Loader2, Save, Sparkles } from "lucide-react";
import { useGetAdminSeo, getGetAdminSeoQueryKey, useUpdateAdminSeo, useRunAdminSeo, useGetAdminSeoAudit, getGetAdminSeoAuditQueryKey, getListAdminSeoLinksQueryKey, type SeoIssue, type SeoRunResult, type SeoSample } from "@workspace/api-client-react";
import { PageHead, Panel } from "@/components/admin/admin-layout";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiError, num } from "@/lib/format";
import { SeoHero, SeoMetrics } from "@/components/admin/seo/seo-health";
import { SeoTools } from "@/components/admin/seo/seo-tools";
import { SeoLinks } from "@/components/admin/seo/seo-links";
import { cn } from "@/lib/utils";

const CHIPS: { k: string; l: string }[] = [
  { k: "{name}", l: "назва" }, { k: "{price}", l: "ціна" }, { k: "{category}", l: "категорія" },
  { k: "{store}", l: "магазин" }, { k: "{sku}", l: "код" }, { k: "{article}", l: "артикул" },
];

function render(tpl: string, s: SeoSample, store: string, max: number) {
  const price = Number.isInteger(s.price) ? String(s.price) : s.price.toFixed(2);
  const out = tpl
    .split("{name}").join(s.name).split("{price}").join(price).split("{category}").join(s.category)
    .split("{store}").join(store).split("{sku}").join(s.sku).split("{article}").join(s.article ?? "")
    .replace(/\s+/g, " ").trim();
  return out.length > max ? out.slice(0, max - 1).trimEnd() + "…" : out;
}

function TemplateEditor({ id, label, value, onChange, ideal, rows }: { id: string; label: string; value: string; onChange: (v: string) => void; ideal: number; rows: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (k: string) => {
    const el = ref.current;
    const a = el?.selectionStart ?? value.length, b = el?.selectionEnd ?? value.length;
    const next = value.slice(0, a) + k + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + k.length, a + k.length); });
  };
  const over = value.length > (id === "title" ? 200 : 400);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between"><label htmlFor={`seo-${id}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label><span className={cn("font-mono text-[11px] tabular", over ? "text-destructive" : "text-muted-foreground")} data-testid={`text-count-${id}`}>{value.length} симв. шаблону · ідеал результату ≤ {ideal}</span></div>
      <textarea id={`seo-${id}`} ref={ref} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} data-testid={`input-template-${id}`} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm leading-relaxed outline-none focus:border-primary" />
      <div className="mt-1.5 flex flex-wrap gap-1">{CHIPS.map((c) => <button key={c.k} type="button" onClick={() => insert(c.k)} data-testid={`chip-${id}-${c.k.slice(1, -1)}`} className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] hover:border-primary hover:text-primary"><span className="font-mono">{c.k}</span> <span className="text-muted-foreground">{c.l}</span></button>)}</div>
    </div>
  );
}

export default function SeoPage() {
  const { data: s, isLoading, isError, refetch } = useGetAdminSeo({ query: { queryKey: getGetAdminSeoQueryKey() } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [savedHint, setSavedHint] = useState(false);
  const [result, setResult] = useState<SeoRunResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [issue, setIssue] = useState<SeoIssue | null>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const { data: audit } = useGetAdminSeoAudit({ query: { queryKey: getGetAdminSeoAuditQueryKey() } });
  const inited = useRef(false);
  useEffect(() => { if (s && !inited.current) { inited.current = true; setTitle(s.titleTemplate); setDesc(s.descriptionTemplate); } }, [s]);
  const save = useUpdateAdminSeo();
  const run = useRunAdminSeo();
  useEffect(() => {
    if (!run.isPending) return;
    const t0 = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - t0) / 1000), 100);
    return () => clearInterval(t);
  }, [run.isPending]);

  if (isError) return <Panel><div className="p-10 text-center"><p className="font-semibold">Не вдалося завантажити SEO</p><button onClick={() => refetch()} className="mt-3 rounded-lg bg-foreground px-4 py-2 text-sm text-background" data-testid="button-retry-seo">Спробувати знову</button></div></Panel>;
  if (isLoading || !s) return <div className="space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-44 rounded-2xl" /><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-80 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div></div>;

  const dirty = title !== s.titleTemplate || desc !== s.descriptionTemplate;
  const titleErr = !title.includes("{name}");
  const cov = s.productsInStock ? (s.productsWithSeo / s.productsInStock) * 100 : 0;
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: getGetAdminSeoQueryKey() });
    qc.invalidateQueries({ queryKey: getGetAdminSeoAuditQueryKey() });
    qc.invalidateQueries({ queryKey: getListAdminSeoLinksQueryKey().slice(0, 1) });
  };
  const pickIssue = (i: SeoIssue | null) => {
    setIssue(i);
    if (i) requestAnimationFrame(() => linksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const doSave = () => save.mutate({ data: { titleTemplate: title, descriptionTemplate: desc } }, {
    onSuccess: () => { toast({ title: "Шаблони збережено" }); setSavedHint(true); refreshAll(); },
    onError: (e) => toast({ title: "Не збережено", description: apiError(e).message, variant: "destructive" }),
  });
  const doRun = () => { setResult(null); run.mutate(undefined, {
    onSuccess: (r) => { setResult(r); setSavedHint(false); toast({ title: "SEO оновлено", description: `${num(r.updated)} товарів за ${(r.durationMs / 1000).toFixed(1)} с` }); refreshAll(); },
    onError: (e) => { const er = apiError(e); toast({ title: er.status === 409 ? "Оновлення вже триває" : "Не вдалося оновити", description: er.status === 409 ? "Дочекайтесь завершення." : er.message, variant: er.status === 409 ? undefined : "destructive" }); },
  }); };
  const toggleAuto = (v: boolean) => save.mutate({ data: { autoAfterSync: v } }, {
    onSuccess: () => { toast({ title: v ? "Автооновлення SEO увімкнено" : "Автооновлення SEO вимкнено" }); qc.invalidateQueries({ queryKey: getGetAdminSeoQueryKey() }); },
    onError: (e) => toast({ title: "Не збережено", description: apiError(e).message, variant: "destructive" }),
  });

  return (
    <div>
      <PageHead title="SEO-центр" sub="Як ваш магазин бачать Google, соцмережі та покупці" />
      <SeoHero audit={audit} coverage={cov} withSeo={s.productsWithSeo} inStock={s.productsInStock} lastRunAt={s.lastRunAt} lastRunCount={s.lastRunCount}
        running={run.isPending} elapsed={elapsed} result={result} onRun={doRun} />
      <SeoMetrics audit={audit} activeIssue={issue} onPick={pickIssue} />
      <SeoTools sitemapPath={s.sitemapPath} sampleProductPath={s.samples[0] ? `/product/${s.samples[0].id}` : null} />

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel className="min-w-0" title="Шаблони" action={<button type="button" onClick={doSave} disabled={!dirty || titleErr || save.isPending} data-testid="button-save-templates" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-bold text-background disabled:opacity-35">{save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Зберегти</button>}>
          <div className="space-y-4 p-4">
            <TemplateEditor id="title" label="Заголовок (title)" value={title} onChange={setTitle} ideal={70} rows={2} />
            {titleErr && <p className="-mt-2 text-xs font-semibold text-destructive" data-testid="text-title-error">Заголовок має містити {"{name}"} — назву товару.</p>}
            <TemplateEditor id="description" label="Опис (description)" value={desc} onChange={setDesc} ideal={160} rows={4} />
            {dirty && <p className="text-xs text-muted-foreground">Є незбережені зміни — превʼю праворуч вже показує новий варіант.</p>}
            {savedHint && !dirty && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-3 text-sm" data-testid="hint-run-after-save">
                <span className="flex-1">Шаблони збережено. Застосуйте їх до всіх товарів.</span>
                <button type="button" onClick={doRun} disabled={run.isPending} data-testid="button-run-seo-after-save" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Оновити зараз</button>
              </div>
            )}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted/60 p-3">
              <Switch checked={s.autoAfterSync} onCheckedChange={toggleAuto} disabled={save.isPending} data-testid="switch-auto-seo" />
              <span className="text-sm"><span className="font-semibold">Автоматично оновлювати SEO після кожної синхронізації складу</span><span className="block text-xs text-muted-foreground">Нові товари одразу отримають заголовок і опис.</span></span>
            </label>
          </div>
        </Panel>

        <Panel className="min-w-0" title="Як це виглядатиме в Google">
          {s.samples.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Немає товарів для прикладу — запустіть синхронізацію.</p> : (
            <ul className="divide-y divide-border">
              {s.samples.map((x) => {
                const t = render(title, x, s.storeName, 70), d = render(desc, x, s.storeName, 160);
                const changed = (x.seoTitle && x.seoTitle !== t) || (x.seoDescription && x.seoDescription !== d);
                return (
                  <li key={x.id} className="p-4" data-testid={`preview-${x.id}`}>
                    <div className="flex items-center gap-2 text-xs text-[hsl(220_8%_35%)]"><span className="grid h-6 w-6 place-items-center rounded-full bg-muted"><Globe className="h-3.5 w-3.5" /></span><span className="min-w-0 truncate">{window.location.host} › product › {x.id}</span></div>
                    <div className="mt-1 text-lg leading-snug text-[hsl(225_70%_42%)] hover:underline">{t}</div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[hsl(220_8%_32%)]">{d}</p>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">{t.length}/70 · {d.length}/160</div>
                    {changed && (
                      <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/40 p-2 text-[11px]">
                        <div className="mb-0.5 font-bold uppercase tracking-wider text-muted-foreground">Зараз на сайті</div>
                        {x.seoTitle && <div className="truncate font-semibold">{x.seoTitle}</div>}
                        {x.seoDescription && <div className="line-clamp-2 text-muted-foreground">{x.seoDescription}</div>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <SeoLinks ref={linksRef} audit={audit} issue={issue} onIssue={setIssue} />

      <Panel title="Як додати магазин у Google">
        <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ol className="space-y-2 text-sm">
            {["Відкрийте Google Search Console і додайте свій сайт (підтвердіть, що він ваш).", "У меню ліворуч виберіть «Файли Sitemap».", "Вставте посилання на карту сайту (кнопка «Копіювати» вище) і натисніть «Надіслати». Google сам почне знаходити ваші товари."].map((t, i) => (
              <li key={i} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-foreground font-mono text-xs font-bold text-background">{i + 1}</span><span className="pt-0.5">{t}</span></li>
            ))}
            <li><a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" data-testid="link-search-console" className="inline-flex items-center gap-1 pl-9 text-xs font-semibold text-primary hover:underline">Відкрити Search Console<ExternalLink className="h-3 w-3" /></a></li>
          </ol>
          <p className="flex gap-2 self-start rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />Кожна сторінка товару вже має власний заголовок, опис, картинку для прев'ю в соцмережах і розмітку товару для Google (ціна, наявність). Карта сайту оновлюється автоматично.</p>
        </div>
      </Panel>
    </div>
  );
}
