import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

function Big({ label, value, sub, tone, testid }: { label: string; value: number; sub?: string; tone?: "profit" | "dark"; testid: string }) {
  return (
    <div className={cn("min-w-0 rounded-xl p-3", tone === "dark" ? "bg-sidebar text-sidebar-foreground" : tone === "profit" ? "bg-[hsl(160_45%_90%)] text-[hsl(165_55%_20%)]" : "bg-muted/60")}>
      <div className={cn("text-[10px] font-semibold uppercase tracking-wider", tone === "dark" ? "text-sidebar-foreground/60" : "opacity-70")}>{label}</div>
      <div className="mt-1 truncate font-mono text-xl font-semibold tabular sm:text-2xl" title={uah(value)} data-testid={testid}>≈ {uahCompact(value)}</div>
      {sub && <div className={cn("mt-0.5 truncate text-[11px]", tone === "dark" ? "text-sidebar-foreground/60" : "opacity-70")}>{sub}</div>}
    </div>
  );
}

export function MoneySummary({ params }: { params: GetAdminProductsSummaryParams }) {
  const { data: s, isLoading, isError, refetch } = useGetAdminProductsSummary(params, { query: { queryKey: getGetAdminProductsSummaryQueryKey(params) } });
  const [m, setM] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (s && m === null) setM(s.markupPercent); }, [s, m]);
  const qc = useQueryClient();
  const { toast } = useToast();
  const upd = useUpdateAdminSettings();

  if (isError) return <div className="mb-4 rounded-2xl border border-card-border bg-card p-5 text-sm">Не вдалося порахувати вартість товарів. <button className="font-semibold text-primary" onClick={() => refetch()} data-testid="button-retry-summary">Повторити</button></div>;
  if (isLoading || !s) return <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_380px]"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>;

  const markup = m ?? s.markupPercent;
  const revenue = s.costValue * (1 + markup / 100);
  const profit = s.costValue * (markup / 100);
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
          <span className="font-mono text-[11px] text-muted-foreground tabular" data-testid="text-summary-positions">{num(s.positionsWithStock)} з {num(s.positions)} позицій · {num(s.unitsInStock)} шт</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Big label="Вартість закупки" value={s.costValue} sub="стільки коштує товар у постачальника" testid="text-summary-cost" />
          <Big tone="dark" label="Виручка" value={s.retailValue} sub="за поточними цінами магазину" testid="text-summary-retail" />
          <Big tone="profit" label="Ваш прибуток" value={s.profit} sub={`маржа ${pct(s.marginPercent)} · націнка ${pct(s.markupPercent, 0)}`} testid="text-summary-profit" />
        </div>
        <p className="mt-3 flex gap-1.5 text-[11px] leading-snug text-muted-foreground"><Info className="mt-px h-3 w-3 shrink-0" />Це залишок на складі постачальника — ви купуєте товар лише після замовлення клієнта. Постачальник обмежує показ кількості (напр. «100»), тож суми приблизні.</p>
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
          <div className="rounded-xl bg-muted/60 p-2.5"><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Виручка</div><div className="truncate font-mono text-lg font-semibold tabular" title={uah(revenue)} data-testid="text-whatif-revenue">≈ {uahCompact(revenue)}</div></div>
          <div className="rounded-xl bg-[hsl(160_45%_90%)] p-2.5 text-[hsl(165_55%_20%)]"><div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Прибуток</div><div className="truncate font-mono text-lg font-semibold tabular" title={uah(profit)} data-testid="text-whatif-profit">≈ {uahCompact(profit)}</div></div>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">Оцінка: закупка × націнку. Не враховує округлення та ціни, задані вручну.</p>
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
