import { useEffect, useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Calculator, Info, Loader2 } from "lucide-react";
import {
  useGetAdminProductsSummary, getGetAdminProductsSummaryQueryKey, useUpdateAdminSettings, getGetAdminSettingsQueryKey,
  getListAdminProductsQueryKey, getGetAdminInventoryQueryKey, getGetAdminDashboardQueryKey, type GetAdminProductsSummaryParams,
} from "@workspace/api-client-react";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiError, num, pct, uah, uahCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Guaranteed amount (big) with the top of the supplier's stock range underneath. */
function Big({ label, value, max, sub, tone, testid }: { label: string; value: number; max?: number; sub?: string; tone?: "profit" | "dark"; testid: string }) {
  const hasRange = max !== undefined && max - value >= 1;
  return (
    <div className={cn("min-w-0 rounded-xl p-3", tone === "dark" ? "bg-sidebar text-sidebar-foreground" : tone === "profit" ? "bg-[hsl(160_45%_90%)] text-[hsl(165_55%_20%)]" : "bg-muted/60")}>
      <div className={cn("text-[10px] font-semibold uppercase tracking-wider", tone === "dark" ? "text-sidebar-foreground/60" : "opacity-70")}>{label}</div>
      <div className="mt-1 truncate font-mono text-xl font-semibold tabular sm:text-2xl" title={uah(value)} data-testid={testid}>{hasRange ? "від " : ""}{uahCompact(value)}</div>
      {hasRange && <div className="truncate font-mono text-xs font-semibold tabular opacity-80" title={uah(max)} data-testid={`${testid}-max`}>до {uahCompact(max)}</div>}
      {sub && <div className={cn("mt-0.5 truncate text-[11px]", tone === "dark" ? "text-sidebar-foreground/60" : "opacity-70")}>{sub}</div>}
    </div>
  );
}

export function MoneySummary({ params }: { params: GetAdminProductsSummaryParams }) {
  const { data: s, isLoading, isError, refetch } = useGetAdminProductsSummary(params, { query: { queryKey: getGetAdminProductsSummaryQueryKey(params) } });
  const [m, setM] = useState<number | null>(null);
  // Exact what-if from the server (rounding and manual prices included), debounced while dragging.
  const [debounced, setDebounced] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => setDebounced(m), 350); return () => clearTimeout(t); }, [m]);
  const wiParams: GetAdminProductsSummaryParams = { ...params, whatIfMarkup: debounced ?? undefined };
  const { data: wi, isFetching: wiLoading } = useGetAdminProductsSummary(wiParams, { query: { queryKey: getGetAdminProductsSummaryQueryKey(wiParams), enabled: debounced !== null && !!s && debounced !== s.markupPercent, placeholderData: keepPreviousData } });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (s && m === null) setM(s.markupPercent); }, [s, m]);
  const qc = useQueryClient();
  const { toast } = useToast();
  const upd = useUpdateAdminSettings();

  if (isError) return <div className="mb-4 rounded-2xl border border-card-border bg-card p-5 text-sm">Не вдалося порахувати вартість товарів. <button className="font-semibold text-primary" onClick={() => refetch()} data-testid="button-retry-summary">Повторити</button></div>;
  if (isLoading || !s) return <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_380px]"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>;

  const markup = m ?? s.markupPercent;
  const same = markup === s.markupPercent;
  const w = same ? { retailValue: s.retailValue, profit: s.profit, retailValueMax: s.retailValueMax, profitMax: s.profitMax } : wi?.whatIf ?? null;
  const pending = !same && (wiLoading || !w || wi?.whatIf?.markupPercent !== markup);
  const changed = Math.round(markup) !== Math.round(s.markupPercent);
  const apply = () => upd.mutate({ data: { markupPercent: markup } }, {
    onSuccess: () => {
      toast({ title: `Націнку ${markup}% застосовано`, description: "Ціни в магазині перераховано." });
      [getGetAdminSettingsQueryKey(), getListAdminProductsQueryKey(), getGetAdminProductsSummaryQueryKey(), getGetAdminInventoryQueryKey(), getGetAdminDashboardQueryKey()].forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
    onError: (e) => toast({ title: "Не збережено", description: apiError(e).message, variant: "destructive" }),
    onSettled: () => setConfirm(false),
  });

  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_400px]">
      <section className="rounded-2xl border border-card-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold">Якщо продати весь доступний залишок</h2>
          <span className="font-mono text-[11px] text-muted-foreground tabular" data-testid="text-summary-positions">{num(s.positionsWithStock)} з {num(s.positions)} позицій · {s.unitsMax > s.unitsInStock ? `від ${num(s.unitsInStock)} до ${num(s.unitsMax)}` : num(s.unitsInStock)} шт</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Big label="Вартість закупки" value={s.costValue} max={s.costValueMax} sub="стільки коштує товар у постачальника" testid="text-summary-cost" />
          <Big tone="dark" label="Виручка" value={s.retailValue} max={s.retailValueMax} sub="за поточними цінами магазину" testid="text-summary-retail" />
          <Big tone="profit" label="Ваш прибуток" value={s.profit} max={s.profitMax} sub={`маржа ${pct(s.marginPercent)} · націнка ${pct(s.markupPercent, 0)}`} testid="text-summary-profit" />
        </div>
        <p className="mt-3 flex gap-1.5 text-[11px] leading-snug text-muted-foreground"><Info className="mt-px h-3 w-3 shrink-0" />
          <span>Рахуються лише товари, які можна купити в магазині: є на складі, не приховані, з ціною. Ціни — точно як у магазині (з округленням і ручними цінами). Малі залишки постачальник показує точно, а більші — діапазоном («5–10», «10–50», «50–100»), тому «від» — гарантований мінімум, «до» — верхня межа. Точно відома кількість у {num(s.exactPositions)} з {num(s.positionsWithStock)} позицій.</span></p>
      </section>

      <section className="rounded-2xl border border-card-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">Калькулятор «а що, якщо»</h2></div>
        <div className="flex items-center gap-3">
          <Slider value={[markup]} min={0} max={150} step={1} onValueChange={(v) => setM(v[0])} className="flex-1" data-testid="slider-markup" />
          <div className="flex h-9 items-center rounded-lg border border-border bg-background pr-2 focus-within:border-primary">
            <input inputMode="numeric" value={markup} onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, "")); setM(Math.min(500, Number.isFinite(v) ? v : 0)); }} className="h-full w-12 bg-transparent text-right font-mono text-sm font-semibold outline-none" data-testid="input-markup" />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([["Виручка", w?.retailValue, w?.retailValueMax, "text-whatif-revenue", "bg-muted/60"], ["Прибуток", w?.profit, w?.profitMax, "text-whatif-profit", "bg-[hsl(160_45%_90%)] text-[hsl(165_55%_20%)]"]] as const).map(([l, v, mx, tid, cls]) => (
            <div key={tid} className={cn("min-w-0 rounded-xl p-2.5 transition-opacity", cls, pending && "opacity-50")}>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{l}</div>
              <div className="truncate font-mono text-lg font-semibold tabular" title={v != null ? uah(v) : undefined} data-testid={tid}>{v != null ? `${mx != null && mx - v >= 1 ? "від " : ""}${uahCompact(v)}` : "…"}</div>
              {v != null && mx != null && mx - v >= 1 && <div className="truncate font-mono text-[11px] font-semibold tabular opacity-80" title={uah(mx)}>до {uahCompact(mx)}</div>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">Рахується точно: кожна ціна перераховується з новою націнкою та округленням. Ручні ціни не змінюються.</p>
        <button type="button" disabled={!changed || upd.isPending} onClick={() => setConfirm(true)} data-testid="button-apply-markup" className="mt-3 h-9 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40">
          {changed ? `Застосувати цю націнку до магазину (${markup}%)` : "Це поточна націнка магазину"}
        </button>
      </section>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Змінити націнку на {markup}%?</AlertDialogTitle>
            <AlertDialogDescription>Зараз {s.markupPercent}%. Усі автоматичні ціни в магазині буде перераховано. Ціни, задані вручну, не зміняться.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-markup">Скасувати</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); apply(); }} data-testid="button-confirm-markup">{upd.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Так, застосувати"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
