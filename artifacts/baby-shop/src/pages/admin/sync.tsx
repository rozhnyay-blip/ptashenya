import { PriceAccessBanner } from "@/components/admin/price-access-banner";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, CircleAlert, Clock, EyeOff, Loader2, PackagePlus, RefreshCcw, RotateCcw, Search } from "lucide-react";
import {
  useGetSyncStatus, getGetSyncStatusQueryKey, useGetAdminDashboard, useListSyncRuns, getListSyncRunsQueryKey, useListSyncSources, getListSyncSourcesQueryKey,
  useUpdateSyncSources, useGetAdminSettings, getGetAdminSettingsQueryKey, useUpdateAdminSettings, getGetAdminDashboardQueryKey,
  getListCategoriesQueryKey, getGetStorefrontHighlightsQueryKey, type SyncRun,
} from "@workspace/api-client-react";
import { PageHead, Panel } from "@/components/admin/admin-layout";
import { SyncButton } from "@/components/admin/sync-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiError, dateTime, num, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function duration(r: SyncRun) {
  const end = r.finishedAt ? new Date(r.finishedAt).getTime() : Date.now();
  const s = Math.max(0, Math.round((end - new Date(r.startedAt).getTime()) / 1000));
  return s < 60 ? `${s} с` : `${Math.floor(s / 60)} хв ${s % 60} с`;
}

function ResultTiles({ r }: { r: SyncRun }) {
  const tiles = [
    { i: PackagePlus, v: r.added, l: "нових товарів", c: "bg-[hsl(160_45%_90%)] text-[hsl(165_55%_24%)]" },
    { i: RefreshCcw, v: r.updated, l: "оновлено цін і залишків", c: "bg-accent text-accent-foreground" },
    { i: EyeOff, v: r.wentOutOfStock, l: "закінчились на складі", c: "bg-primary/12 text-primary" },
    { i: RotateCcw, v: r.backInStock, l: "знову в наявності", c: "bg-secondary/60 text-secondary-foreground" },
  ];
  return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{tiles.map((t) => <div key={t.l} className={cn("rounded-xl p-3", t.c)}><t.i className="mb-1 h-4 w-4" /><div className="font-mono text-2xl font-semibold tabular">{num(t.v)}</div><div className="text-[11px] font-medium opacity-80">{t.l}</div></div>)}</div>;
}

export default function SyncPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: dash } = useGetAdminDashboard({ query: { queryKey: getGetAdminDashboardQueryKey() } });
  const { data: st } = useGetSyncStatus({ query: { queryKey: getGetSyncStatusQueryKey(), refetchInterval: (q) => (q.state.data?.running ? 2000 : 15000) } });
  const running = !!st?.running;
  const { data: runs = [], isLoading: runsLoading } = useListSyncRuns({ query: { queryKey: getListSyncRunsQueryKey(), refetchInterval: running ? 4000 : false } });
  const { data: sources = [], isLoading: srcLoading } = useListSyncSources({ query: { queryKey: getListSyncSourcesQueryKey() } });
  const { data: settings } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const updSources = useUpdateSyncSources();
  const updSettings = useUpdateAdminSettings();

  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running) {
      [getListSyncRunsQueryKey(), getGetAdminDashboardQueryKey(), getListCategoriesQueryKey(), getGetStorefrontHighlightsQueryKey(), getListSyncSourcesQueryKey()].forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast({ title: "Синхронізацію завершено" });
    }
    wasRunning.current = running;
  }, [running, qc, toast]);

  const [sel, setSel] = useState<Set<string> | null>(null);
  const [filter, setFilter] = useState("");
  const selected = useMemo(() => sel ?? new Set(sources.filter((s) => s.enabled).map((s) => s.supplierCatId)), [sel, sources]);
  const dirty = sel !== null && (sel.size !== sources.filter((s) => s.enabled).length || sources.some((s) => s.enabled !== sel.has(s.supplierCatId)));
  const toggle = (id: string) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const saveSources = () => updSources.mutate({ data: { enabledIds: Array.from(selected) } }, {
    onSuccess: (res) => { qc.setQueryData(getListSyncSourcesQueryKey(), res); setSel(null); toast({ title: "Джерела збережено", description: "Зміни застосуються під час наступної синхронізації." }); },
    onError: (e) => toast({ title: "Не збережено", description: apiError(e).message, variant: "destructive" }),
  });
  const saveAuto = (data: { autoSyncEnabled?: boolean; autoSyncHour?: number }) => updSettings.mutate({ data }, {
    onSuccess: (res) => { qc.setQueryData(getGetAdminSettingsQueryKey(), res); qc.invalidateQueries({ queryKey: getGetSyncStatusQueryKey() }); toast({ title: "Розклад оновлено" }); },
    onError: (e) => toast({ title: "Не збережено", description: apiError(e).message, variant: "destructive" }),
  });

  const cur = st?.current;
  const pct = cur?.pagesTotal ? Math.min(100, (cur.pagesScanned / cur.pagesTotal) * 100) : null;
  const last = st?.lastRun ?? runs.find((r) => r.status !== "running");
  const shownSources = sources.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <PageHead title="Синхронізація зі складом" sub="Постачальник: toysi.ua" />
      <PriceAccessBanner noPrice={dash?.productsNoPrice ?? 0} connected={!!st?.supplierAccountConnected} />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-2xl bg-sidebar p-6 text-sidebar-foreground">
            <div className="blob absolute -right-16 -top-20 h-60 w-60 bg-primary/25" />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
              <div className="flex-1">
                <h2 className="font-display text-xl font-bold">{running ? "Звіряємося зі складом..." : "Склад і магазин — синхронно"}</h2>
                <p className="mt-1 max-w-lg text-sm text-sidebar-foreground/70">Ми обходимо каталог постачальника: нові товари з'являються в магазині самі, ціни оновлюються з вашою націнкою, а те, що розкупили на складі, автоматично ховається від покупців.</p>
              </div>
              <SyncButton size="lg" running={running} />
            </div>
            {running && cur && (
              <div className="relative mt-6 space-y-3" data-testid="sync-progress">
                <div className="h-3 overflow-hidden rounded-full bg-sidebar-accent">
                  {pct !== null ? <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
                    : <div className="h-full w-1/3 animate-[marquee_1.4s_linear_infinite] rounded-full bg-primary" />}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs tabular text-sidebar-foreground/80">
                  <span>Сторінок: {cur.pagesScanned}{cur.pagesTotal ? ` / ${cur.pagesTotal}` : ""}{pct !== null && ` (${pct.toFixed(0)}%)`}</span>
                  <span>Товарів переглянуто: {num(cur.productsSeen)}</span>
                  <span>+{cur.added} нових · {cur.updated} оновл.</span>
                  <span>Триває {duration(cur)}</span>
                </div>
                {cur.currentStep && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin text-secondary" />{cur.currentStep}</div>}
              </div>
            )}
          </section>

          {last && !running && (
            <Panel title={<span className="flex items-center gap-2">{last.status === "failed" ? <CircleAlert className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-[hsl(165_55%_35%)]" />}Останній запуск · {relTime(last.finishedAt ?? last.startedAt)}</span>} action={<span className="font-mono text-xs text-muted-foreground">{duration(last)} · {num(last.productsSeen)} товарів</span>}>
              <div className="p-4">
                {last.status === "failed" && <div className="mb-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{last.errorMessage ?? "Помилка під час синхронізації"}</div>}
                <ResultTiles r={last} />
              </div>
            </Panel>
          )}

          <Panel title="Історія запусків">
            {runsLoading ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
              : runs.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">Ще жодного запуску. Натисніть «Синхронізувати зараз» — перший імпорт може тривати кілька хвилин.</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-2">Початок</th><th className="px-2">Тип</th><th className="px-2">Статус</th><th className="px-2 text-right">Тривалість</th><th className="px-2 text-right">Переглянуто</th><th className="px-2 text-right">Нові</th><th className="px-2 text-right">Оновл.</th><th className="px-2 text-right">Закінч.</th><th className="px-4 text-right">Поверн.</th></tr></thead>
                    <tbody>{runs.map((r) => (
                      <tr key={r.id} className="border-b border-border/70" data-testid={`row-run-${r.id}`} title={r.errorMessage ?? undefined}>
                        <td className="whitespace-nowrap px-4 py-2 text-xs">{dateTime(r.startedAt)}</td>
                        <td className="px-2 text-xs text-muted-foreground">{r.trigger === "scheduled" ? "за розкладом" : "вручну"}</td>
                        <td className="px-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", r.status === "success" ? "bg-[hsl(160_45%_90%)] text-[hsl(165_55%_24%)]" : r.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-secondary")}>{r.status === "success" ? "успішно" : r.status === "failed" ? "помилка" : "триває"}</span></td>
                        <td className="px-2 text-right font-mono text-xs tabular">{duration(r)}</td>
                        <td className="px-2 text-right font-mono text-xs tabular">{num(r.productsSeen)}</td>
                        <td className="px-2 text-right font-mono text-xs tabular text-[hsl(165_55%_30%)]">+{r.added}</td>
                        <td className="px-2 text-right font-mono text-xs tabular">{r.updated}</td>
                        <td className="px-2 text-right font-mono text-xs tabular text-primary">−{r.wentOutOfStock}</td>
                        <td className="px-4 text-right font-mono text-xs tabular">{r.backInStock}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title={<span className="flex items-center gap-2"><Clock className="h-4 w-4" />Щоденна автосинхронізація</span>}>
            <div className="space-y-4 p-4">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm">Запускати щодня автоматично</span>
                <Switch checked={settings?.autoSyncEnabled ?? false} disabled={!settings || updSettings.isPending} onCheckedChange={(v) => saveAuto({ autoSyncEnabled: v })} data-testid="switch-auto-sync" />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm">Час (Київ)</span>
                <select value={settings?.autoSyncHour ?? 4} disabled={!settings?.autoSyncEnabled} onChange={(e) => saveAuto({ autoSyncHour: Number(e.target.value) })} data-testid="select-auto-sync-hour" className="h-9 rounded-lg border border-border bg-background px-2 font-mono text-sm disabled:opacity-50">
                  {Array.from({ length: 24 }).map((_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
              </label>
              {st?.autoSyncEnabled && st.nextScheduledAt && <p className="rounded-lg bg-muted p-2.5 text-xs">Наступний запуск: <b>{dateTime(st.nextScheduledAt)}</b></p>}
              <p className="text-xs text-muted-foreground">Радимо нічний час — тоді склад найменше змінюється, а зранку магазин уже актуальний.</p>
            </div>
          </Panel>
          <Panel title={`Категорії постачальника · ${selected.size}/${sources.length}`} action={sources.length > 0 && <div className="flex gap-2 text-[11px] font-semibold"><button type="button" onClick={() => setSel(new Set(sources.map((s) => s.supplierCatId)))} className="text-primary" data-testid="button-select-all-sources">усі</button><button type="button" onClick={() => setSel(new Set())} className="text-muted-foreground" data-testid="button-select-none-sources">жодної</button></div>}>
            <div className="p-3">
              <p className="mb-2 px-1 text-xs text-muted-foreground">Оберіть, які розділи складу імпортувати в магазин.</p>
              {sources.length > 8 && <div className="relative mb-2"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Фільтр" className="h-8 w-full rounded-lg border border-border bg-background pl-8 text-xs outline-none" data-testid="input-sources-filter" /></div>}
              {srcLoading ? <div className="space-y-1.5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
                : sources.length === 0 ? <p className="p-4 text-center text-xs text-muted-foreground">Список з'явиться після першого звернення до складу.</p>
                : (
                  <ul className="max-h-[420px] space-y-0.5 overflow-y-auto">
                    {shownSources.map((s) => (
                      <li key={s.supplierCatId}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted">
                          <Checkbox checked={selected.has(s.supplierCatId)} onCheckedChange={() => toggle(s.supplierCatId)} data-testid={`checkbox-source-${s.supplierCatId}`} />
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm">{s.name}</span><span className="font-mono text-[10px] text-muted-foreground">{s.subcategoryCount} підкат. · {num(s.productCount ?? 0)} імпорт.</span></span>
                          <a href={s.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] font-semibold text-primary hover:underline">відкрити</a>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              {dirty && <button type="button" onClick={saveSources} disabled={updSources.isPending} data-testid="button-save-sources" className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-bold text-background">{updSources.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Зберегти вибір</button>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
