import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Copy, ExternalLink, Globe, Loader2, Save, Sparkles, Zap } from "lucide-react";
import { useGetAdminSeo, getGetAdminSeoQueryKey, useUpdateAdminSeo, useRunAdminSeo, type SeoRunResult, type SeoSample } from "@workspace/api-client-react";
import { PageHead, Panel } from "@/components/admin/admin-layout";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiError, dateTime, num, relTime } from "@/lib/format";
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
  const [copied, setCopied] = useState(false);
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
  const sitemap = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "") + s.sitemapPath;

  const doSave = () => save.mutate({ data: { titleTemplate: title, descriptionTemplate: desc } }, {
    onSuccess: () => { toast({ title: "Шаблони збережено" }); setSavedHint(true); qc.invalidateQueries({ queryKey: getGetAdminSeoQueryKey() }); },
    onError: (e) => toast({ title: "Не збережено", description: apiError(e).message, variant: "destructive" }),
  });
  const doRun = () => { setResult(null); run.mutate(undefined, {
    onSuccess: (r) => { setResult(r); setSavedHint(false); toast({ title: "SEO оновлено", description: `${num(r.updated)} товарів за ${(r.durationMs / 1000).toFixed(1)} с` }); qc.invalidateQueries({ queryKey: getGetAdminSeoQueryKey() }); },
    onError: (e) => { const er = apiError(e); toast({ title: er.status === 409 ? "Оновлення вже триває" : "Не вдалося оновити", description: er.status === 409 ? "Дочекайтесь завершення." : er.message, variant: er.status === 409 ? undefined : "destructive" }); },
  }); };
  const toggleAuto = (v: boolean) => save.mutate({ data: { autoAfterSync: v } }, {
    onSuccess: () => { toast({ title: v ? "Автооновлення SEO увімкнено" : "Автооновлення SEO вимкнено" }); qc.invalidateQueries({ queryKey: getGetAdminSeoQueryKey() }); },
    onError: (e) => toast({ title: "Не збережено", description: apiError(e).message, variant: "destructive" }),
  });

  return (
    <div>
      <PageHead title="SEO" sub="Як ваші товари виглядають у Google" />

      <section className="relative mb-4 overflow-hidden rounded-2xl bg-sidebar p-5 text-sidebar-foreground sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/55">Покриття товарів у наявності</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 font-mono tabular">
              <span className="text-4xl font-semibold" data-testid="text-seo-coverage">{cov.toFixed(1)}%</span>
              <span className="text-sm text-sidebar-foreground/65">{num(s.productsWithSeo)} з {num(s.productsInStock)}</span>
            </div>
            <div className="mt-3 h-1.5 max-w-md overflow-hidden rounded-full bg-sidebar-accent"><div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.min(100, cov)}%` }} /></div>
            <div className="mt-3 text-xs text-sidebar-foreground/60" data-testid="text-seo-last-run">{s.lastRunAt ? <>Останнє оновлення {relTime(s.lastRunAt)} ({dateTime(s.lastRunAt)}) · {num(s.lastRunCount ?? 0)} товарів</> : "Ще не запускалось"}</div>
          </div>
          <div className="flex flex-col items-stretch gap-2 lg:items-end">
            <button type="button" onClick={doRun} disabled={run.isPending} data-testid="button-run-seo" className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-primary px-7 text-base font-bold text-primary-foreground shadow-[0_12px_30px_-12px_hsl(14_88%_55%/0.8)] transition hover:-translate-y-0.5 active:translate-y-0 disabled:translate-y-0 disabled:opacity-90">
              {run.isPending ? <><Loader2 className="h-5 w-5 animate-spin" />Оновлюю… <span className="font-mono tabular">{elapsed.toFixed(1)} с</span></> : <><Zap className="h-5 w-5 transition group-hover:rotate-12" />Оновити SEO для всіх товарів</>}
            </button>
            {result && <div className="flex items-center gap-1.5 text-sm text-[hsl(160_55%_75%)]" data-testid="text-seo-result"><CheckCircle2 className="h-4 w-4" />Готово: {num(result.updated)} товарів за {(result.durationMs / 1000).toFixed(1)} с</div>}
            {!result && !run.isPending && <div className="text-[11px] text-sidebar-foreground/50">Займає 5–10 секунд для всього каталогу</div>}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="Шаблони" action={<button type="button" onClick={doSave} disabled={!dirty || titleErr || save.isPending} data-testid="button-save-templates" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-bold text-background disabled:opacity-35">{save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Зберегти</button>}>
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

        <Panel title="Як це виглядатиме в Google">
          {s.samples.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Немає товарів для прикладу — запустіть синхронізацію.</p> : (
            <ul className="divide-y divide-border">
              {s.samples.map((x) => {
                const t = render(title, x, s.storeName, 70), d = render(desc, x, s.storeName, 160);
                const changed = (x.seoTitle && x.seoTitle !== t) || (x.seoDescription && x.seoDescription !== d);
                return (
                  <li key={x.id} className="p-4" data-testid={`preview-${x.id}`}>
                    <div className="flex items-center gap-2 text-xs text-[hsl(220_8%_35%)]"><span className="grid h-6 w-6 place-items-center rounded-full bg-muted"><Globe className="h-3.5 w-3.5" /></span><span className="truncate">{window.location.host} › product › {x.id}</span></div>
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

      <Panel title="Карта сайту для Google" className="mt-4">
        <div className="grid gap-5 p-4 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background p-1.5 pl-3">
              <code className="min-w-0 flex-1 truncate font-mono text-xs" data-testid="text-sitemap-url">{sitemap}</code>
              <button type="button" onClick={() => { navigator.clipboard.writeText(sitemap).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }} data-testid="button-copy-sitemap" className="inline-flex h-8 items-center gap-1 rounded-lg bg-muted px-2.5 text-xs font-semibold hover:bg-muted/70">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Скопійовано" : "Копіювати"}</button>
              <a href={sitemap} target="_blank" rel="noreferrer" data-testid="link-open-sitemap" className="grid h-8 w-8 place-items-center rounded-lg bg-muted hover:bg-muted/70"><ExternalLink className="h-3.5 w-3.5" /></a>
            </div>
            <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted-foreground"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />Кожна сторінка товару вже має власний заголовок, опис, картинку для прев'ю в соцмережах і розмітку товару для Google (ціна, наявність).</p>
          </div>
          <ol className="space-y-2 text-sm">
            {["Відкрийте Google Search Console і додайте свій сайт (підтвердіть, що він ваш).", "У меню ліворуч виберіть «Файли Sitemap».", "Вставте скопійоване посилання і натисніть «Надіслати». Google сам почне знаходити ваші товари."].map((t, i) => (
              <li key={i} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-foreground font-mono text-xs font-bold text-background">{i + 1}</span><span className="pt-0.5">{t}</span></li>
            ))}
            <li><a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" data-testid="link-search-console" className="inline-flex items-center gap-1 pl-9 text-xs font-semibold text-primary hover:underline">Відкрити Search Console<ExternalLink className="h-3 w-3" /></a></li>
          </ol>
        </div>
      </Panel>
    </div>
  );
}
