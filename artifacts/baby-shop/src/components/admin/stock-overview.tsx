import { Link } from "wouter";
import { ArrowRight, Boxes, ClipboardCopy, Clock, Download, Gem, Layers, ListFilter, PackageMinus, RotateCw, TrendingUp, Trophy, Zap } from "lucide-react";
import { useGetAdminStockOverview, getGetAdminStockOverviewQueryKey, type StockOverview, type StockZone } from "@workspace/api-client-react";
import { Panel } from "@/components/admin/admin-layout";
import { StockAsOf } from "@/components/admin/stock-as-of";
import { ProductImage } from "@/components/store/product-image";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { num, pct, uah, uahShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const exportBase = `${import.meta.env.BASE_URL}api/admin/export/products.csv`;
const list = (p: Record<string, string>) => `/admin/products?${new URLSearchParams(p)}`;
const csv = (p: Record<string, string>) => `${exportBase}?${new URLSearchParams(p)}`;

type ZoneKey = "ready" | "onOrder" | "total";
const ZONES: Record<ZoneKey, { title: string; sub: string; stock: string; icon: typeof Zap; tone: string; dot: string }> = {
  ready: { title: "Відправка до 3 днів", sub: "лежить на складі постачальника", stock: "in_stock", icon: Zap, tone: "border-[hsl(165_45%_75%)] bg-[hsl(160_45%_96%)]", dot: "bg-[hsl(165_55%_38%)]" },
  onOrder: { title: "Під замовлення · 7–10 днів", sub: "постачальник везе з іншого складу", stock: "on_order", icon: Clock, tone: "border-[hsl(40_80%_78%)] bg-[hsl(42_90%_96%)]", dot: "bg-[hsl(36_85%_50%)]" },
  total: { title: "Разом усе в наявності", sub: "обидва склади разом", stock: "available", icon: Layers, tone: "border-transparent bg-sidebar text-sidebar-foreground", dot: "bg-primary" },
};

function MoneyRows({ title, m, dark }: { title: string; m: StockZone["oneUnit"]; dark: boolean }) {
  return (
    <div className={cn("rounded-xl p-2.5", dark ? "bg-sidebar-accent/60" : "bg-card/80")}>
      <div className={cn("mb-1 text-[10px] font-semibold uppercase tracking-wider", dark ? "text-sidebar-foreground/60" : "text-muted-foreground")}>{title}</div>
      {([["Закупка", m.costValue, ""], ["Виручка", m.retailValue, ""], ["Прибуток", m.profit, dark ? "text-[hsl(160_60%_70%)]" : "text-[hsl(165_55%_28%)]"]] as const).map(([l, v, c]) => (
        <div key={l} className="flex items-baseline justify-between gap-2 text-xs">
          <span className={dark ? "text-sidebar-foreground/70" : "text-muted-foreground"}>{l}</span>
          <span className={cn("font-mono font-semibold tabular", c)} title={uah(v)}>{uahShort(v)}</span>
        </div>
      ))}
      <div className={cn("mt-0.5 text-right text-[10px]", dark ? "text-sidebar-foreground/50" : "text-muted-foreground")}>маржа {pct(m.marginPercent)}</div>
    </div>
  );
}

function ZoneCard({ k, z }: { k: ZoneKey; z: StockZone }) {
  const c = ZONES[k];
  const dark = k === "total";
  const Icon = c.icon;
  return (
    <div className={cn("flex min-w-0 flex-col rounded-2xl border p-3.5", c.tone)} data-testid={`card-zone-${k}`}>
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", dark ? "bg-primary text-primary-foreground" : "bg-card")}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">{c.title}</div>
          <div className={cn("text-[11px]", dark ? "text-sidebar-foreground/60" : "text-muted-foreground")}>{c.sub}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="font-mono text-2xl font-semibold leading-none tabular" data-testid={`text-zone-${k}-positions`}>{num(z.positions)}</div>
          <div className={cn("mt-1 text-[11px]", dark ? "text-sidebar-foreground/60" : "text-muted-foreground")}>товарів</div>
        </div>
        <div>
          <div className="font-mono text-2xl font-semibold leading-none tabular" data-testid={`text-zone-${k}-units`}>{z.approxPositions > 0 && <span className="text-base opacity-60">≥</span>}{num(z.units)}</div>
          <div className={cn("mt-1 text-[11px]", dark ? "text-sidebar-foreground/60" : "text-muted-foreground")}>штук на складі</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <MoneyRows title="По 1 шт. кожного" m={z.oneUnit} dark={dark} />
        <MoneyRows title="Усі штуки" m={z.allUnits} dark={dark} />
      </div>
      <div className={cn("mt-2 text-[10px]", dark ? "text-sidebar-foreground/55" : "text-muted-foreground")}>
        Найбільший залишок одного товару: <b className="font-mono">{num(z.biggestStock)} шт</b>
      </div>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
        <Link href={list({ stock: c.stock, sort: "stock_desc" })} data-testid={`link-zone-${k}-list`}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition", dark ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-foreground text-background hover:bg-foreground/90")}>
          <ListFilter className="h-3.5 w-3.5" />{dark ? "Показати всі товари" : "Показати товари"}<ArrowRight className="h-3 w-3" />
        </Link>
        <a href={csv({ stock: c.stock })} download data-testid={`link-zone-${k}-export`}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition", dark ? "border-sidebar-border hover:bg-sidebar-accent" : "border-border bg-card hover:bg-muted")}>
          <Download className="h-3.5 w-3.5" />Excel
        </a>
      </div>
    </div>
  );
}

/** Two thin stacked bars: how the stock splits between the warehouses by product count and by money. */
function SplitBars({ o }: { o: StockOverview }) {
  const rows = [
    { l: "За кількістю товарів", a: o.ready.positions, b: o.onOrder.positions, f: num },
    { l: "За сумою всіх штук (виручка)", a: o.ready.allUnits.retailValue, b: o.onOrder.allUnits.retailValue, f: uahShort },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => {
        const t = r.a + r.b || 1;
        const pa = (r.a / t) * 100;
        return (
          <div key={r.l}>
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>{r.l}</span><span className="font-mono tabular">{pa.toFixed(0)}% / {(100 - pa).toFixed(0)}%</span></div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              <div className={ZONES.ready.dot} style={{ width: `${pa}%` }} title={`До 3 днів: ${r.f(r.a)}`} />
              <div className={ZONES.onOrder.dot} style={{ width: `${100 - pa}%` }} title={`Під замовлення: ${r.f(r.b)}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function reportText(o: StockOverview) {
  const d = new Date().toLocaleString("uk-UA", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" });
  const z = (t: string, x: StockZone) => [
    `${t}: ${num(x.positions)} товарів, ${num(x.units)} шт`,
    `  По 1 шт: закупка ${uah(Math.round(x.oneUnit.costValue))}, виручка ${uah(Math.round(x.oneUnit.retailValue))}, прибуток ${uah(Math.round(x.oneUnit.profit))}`,
    `  Усі штуки: закупка ${uah(Math.round(x.allUnits.costValue))}, виручка ${uah(Math.round(x.allUnits.retailValue))}, прибуток ${uah(Math.round(x.allUnits.profit))}`,
  ].join("\n");
  return [`Склад «Пташеня» — ${d} (націнка ${o.markupPercent}%)`, "", z("Відправка до 3 днів", o.ready), "", z("Під замовлення (7–10 днів)", o.onOrder), "", z("Разом усе", o.total)].join("\n");
}

export function StockOverviewPanel() {
  const { data: o, isLoading, isError, refetch, isFetching } = useGetAdminStockOverview({ query: { queryKey: getGetAdminStockOverviewQueryKey() } });
  const { toast } = useToast();

  if (isError) return <Panel className="mt-4"><div className="p-6 text-center text-sm">Не вдалося порахувати склад. <button className="font-semibold text-primary" onClick={() => refetch()} data-testid="button-retry-overview">Повторити</button></div></Panel>;
  if (isLoading || !o) return <div className="mt-4 grid gap-3 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText(o));
      toast({ title: "Звіт скопійовано", description: "Можна вставити в Telegram чи Viber." });
    } catch {
      toast({ title: "Не вдалося скопіювати", variant: "destructive" });
    }
  };
  const maxBucket = Math.max(1, ...o.buckets.map((b) => b.retailValue));
  const chip = "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-semibold transition hover:border-foreground/30 hover:bg-muted";
  const quick: { href: string; l: string; icon: typeof Zap; t: string }[] = [
    { href: list({ stock: "available", sort: "profit_desc" }), l: "Найприбутковіші", icon: TrendingUp, t: "quick-profit" },
    { href: list({ stock: "available", sort: "stock_value_desc" }), l: "Найбільший прибуток із запасу", icon: Gem, t: "quick-stock-value" },
    { href: list({ stock: "available", minQty: "1000", sort: "stock_desc" }), l: "Великі партії 1000+ шт", icon: Boxes, t: "quick-big" },
    { href: list({ stock: "in_stock", maxQty: "2", sort: "sales_desc" }), l: "Залишилось 1–2 шт", icon: PackageMinus, t: "quick-low" },
    { href: list({ stock: "available", sort: "sales_desc" }), l: "Хіти продажів", icon: Trophy, t: "quick-hits" },
  ];

  return (
    <Panel className="mt-4" title={<span className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />Склад постачальника: усе, що можна продати</span>}
      action={<div className="flex gap-1.5">
        <button type="button" onClick={copy} className={chip} data-testid="button-copy-report"><ClipboardCopy className="h-3.5 w-3.5" /><span className="hidden sm:inline">Скопіювати звіт</span></button>
        <button type="button" onClick={() => refetch()} disabled={isFetching} className={cn(chip, "disabled:opacity-60")} data-testid="button-refresh-overview" title="Перерахувати"><RotateCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} /></button>
      </div>}>
      <div className="space-y-4 p-4">
        <StockAsOf />
        <div className="grid gap-3 lg:grid-cols-3">
          <ZoneCard k="ready" z={o.ready} />
          <ZoneCard k="onOrder" z={o.onOrder} />
          <ZoneCard k="total" z={o.total} />
        </div>
        <SplitBars o={o} />
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Швидкі добірки</div>
          <div className="flex flex-wrap gap-1.5">
            {quick.map((q) => <Link key={q.t} href={q.href} className={chip} data-testid={`link-${q.t}`}><q.icon className="h-3.5 w-3.5 text-primary" />{q.l}</Link>)}
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-border">
            <div className="border-b border-border px-3 py-2 text-xs font-bold">Скільки штук лежить на складі</div>
            <ul className="divide-y divide-border">{o.buckets.map((b) => (
              <li key={b.label}>
                <Link href={list({ stock: "available", minQty: String(b.minQty), ...(b.maxQty != null ? { maxQty: String(b.maxQty) } : {}), sort: "stock_desc" })} className="block px-3 py-2 hover:bg-muted/40" data-testid={`link-bucket-${b.minQty}`}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-semibold">{b.label} <span className="font-normal text-muted-foreground">· {num(b.positions)} товарів{b.positions > 0 && <> (до 3 днів: {num(b.readyPositions)})</>}</span></span>
                    <span className="font-mono font-semibold tabular" title={uah(b.retailValue)}>{uahShort(b.retailValue)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[hsl(285_35%_30%)]" style={{ width: `${(b.retailValue / maxBucket) * 100}%` }} /></div>
                    <span className="w-24 text-right font-mono text-[10px] text-muted-foreground tabular">{num(b.units)} шт</span>
                  </div>
                </Link>
              </li>
            ))}</ul>
            <p className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">Сума — усі штуки за цінами магазину. Натисніть рядок, щоб побачити ці товари.</p>
          </div>
          <div className="rounded-xl border border-border">
            <div className="border-b border-border px-3 py-2 text-xs font-bold">Найбільші запаси за сумою закупки</div>
            {o.topByValue.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Поки немає даних.</p> : (
              <ul className="divide-y divide-border">{o.topByValue.map((p, i) => (
                <li key={p.id}><Link href={list({ q: p.sku })} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/40" data-testid={`link-top-stock-${p.id}`}>
                  <span className="w-4 text-right font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                  <ProductImage src={p.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg" imgClassName="p-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium" title={p.name}>{p.name}</div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">{num(p.stockQty)} шт × {uah(p.price)}
                      {p.deliveryDays != null && p.deliveryDays > 3 ? <span className="rounded bg-[hsl(40_90%_90%)] px-1 font-sans font-semibold text-[hsl(30_70%_28%)]">до {p.deliveryDays} дн</span> : <span className="rounded bg-[hsl(160_45%_90%)] px-1 font-sans font-semibold text-[hsl(165_55%_24%)]">до 3 дн</span>}
                    </div>
                  </div>
                  <span className="font-mono text-xs font-semibold tabular" title={uah(p.costValue)}>{uahShort(p.costValue)}</span>
                </Link></li>
              ))}</ul>
            )}
          </div>
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          Рахуються лише товари, які можна купити у вашому магазині (не приховані, з ціною). Де постачальник показує тільки «від–до» (наприклад, 10…50), беремо мінімум — тому біля штук стоїть «≥».
        </p>
      </div>
    </Panel>
  );
}
