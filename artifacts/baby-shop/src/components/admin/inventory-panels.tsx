import { Link } from "wouter";
import { Download, Flame, LineChart, ListFilter, Warehouse } from "lucide-react";
import { useGetAdminInventory, getGetAdminInventoryQueryKey, useListAdminPriceChanges, getListAdminPriceChangesQueryKey } from "@workspace/api-client-react";
import { Panel } from "@/components/admin/admin-layout";
import { ProductImage } from "@/components/store/product-image";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangeBadge } from "@/pages/admin/prices";
import { StockAsOf } from "@/components/admin/stock-as-of";
import { CountModeToggle, useCountMode } from "@/components/admin/count-mode";
import { num, pct, relTime, uah } from "@/lib/format";

export function InventoryPanels() {
  const { data: inv, isLoading, isError, refetch } = useGetAdminInventory({ query: { queryKey: getGetAdminInventoryQueryKey() } });
  const pp = { limit: 5 };
  const [mode] = useCountMode();
  const { data: pc, isLoading: pcLoading } = useListAdminPriceChanges(pp, { query: { queryKey: getListAdminPriceChangesQueryKey(pp) } });

  if (isError) return <Panel className="mt-4"><div className="p-6 text-center text-sm">Не вдалося порахувати склад. <button className="font-semibold text-primary" onClick={() => refetch()} data-testid="button-retry-inventory">Повторити</button></div></Panel>;
  if (isLoading || !inv) return <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]"><Skeleton className="h-80 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>;
  const all = mode === "all";
  const cur = all ? inv.allUnits : inv;
  const cats = inv.categories.map((c) => ({ ...c, cur: all ? c.allUnits : c })).sort((a, b) => b.cur.profit - a.cur.profit);
  const maxR = Math.max(1, ...cats.map((c) => c.cur.retailValue));

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
      <Panel title={<span className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-primary" />{all ? "Наявність сьогодні — усі штуки" : "Наявність сьогодні — по 1 шт. кожного товару"}</span>}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 pt-3">
          <span className="text-xs font-semibold text-muted-foreground">Як рахувати:</span>
          <CountModeToggle />
        </div>
        <div className="border-b border-border p-3"><StockAsOf /></div>
        <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
          {[
            ["Закупка", cur.costValue, all ? `${num(inv.allUnits.units)} шт · ${num(inv.positionsInStock)} товарів` : `${num(inv.positionsInStock)} товарів × 1 шт`],
            ["Виручка", cur.retailValue, `націнка ${pct(inv.markupPercent, 0)}`],
            ["Прибуток", cur.profit, `маржа ${pct(cur.marginPercent)}`],
          ].map(([l, v, sub], i) => (
            <div key={l as string} className={i === 2 ? "col-span-2 bg-[hsl(160_45%_93%)] p-4 text-[hsl(165_55%_20%)] sm:col-span-2" : "bg-card p-4"}>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{l}</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular" title={uah(v as number)} data-testid={`text-inventory-${i}`}>{uah(Math.round(v as number))}</div>
              <div className="text-[11px] opacity-70">{sub}</div>
            </div>
          ))}
        </div>
        {cats.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Товарів у наявності немає</p> : (
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card"><tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-2">Категорія</th><th className="hidden px-2 text-right sm:table-cell">{all ? "Штук" : "Товарів"}</th><th className="px-2 text-right">Виручка</th><th className="px-4 text-right">Прибуток</th></tr></thead>
              <tbody>{cats.map((c) => (
                <tr key={c.categoryId} className="border-t border-border/70 hover:bg-muted/40">
                  <td className="px-4 py-1.5"><Link href={`/admin/products?cat=${c.categoryId}&stock=in_stock`} className="block" data-testid={`link-inv-cat-${c.categoryId}`}><div className="truncate font-medium">{c.name}</div><div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[hsl(285_35%_30%)]" style={{ width: `${(c.cur.retailValue / maxR) * 100}%` }} /></div></Link></td>
                  <td className="hidden px-2 text-right font-mono tabular text-muted-foreground sm:table-cell">{num(all ? c.allUnits.units : c.positions)}</td>
                  <td className="px-2 text-right font-mono tabular" title={uah(c.cur.retailValue)}>{uah(Math.round(c.cur.retailValue))}</td>
                  <td className="px-4 text-right font-mono font-semibold tabular text-[hsl(165_55%_28%)]" title={uah(c.cur.profit)}>{uah(Math.round(c.cur.profit))}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">{all
          ? <>Рахуються всі штуки на складі постачальника за цінами магазину.{inv.allUnits.approxPositions > 0 && <> Для {num(inv.allUnits.approxPositions)} товарів відомо лише «від–до» (наприклад, 10…50) — беремо мінімум, тож насправді може бути трохи більше.</>}</>
          : "Кожен товар у наявності рахується 1 раз (1 шт.) за цінами магазину."} Натисніть на категорію, щоб побачити її товари.</p>
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          <Link href="/admin/products?stock=in_stock" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-bold text-background transition hover:bg-foreground/90" data-testid="link-inventory-products"><ListFilter className="h-3.5 w-3.5" />Усі товари в наявності</Link>
          <a href={`${import.meta.env.BASE_URL}api/admin/export/products.csv?stock=in_stock`} download className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold transition hover:bg-muted" data-testid="link-inventory-export"><Download className="h-3.5 w-3.5" />Завантажити список (Excel)</a>
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel title={<span className="flex items-center gap-2"><Flame className="h-4 w-4 text-primary" />Хіти, що закінчуються</span>}>
          {inv.lowStockBestsellers.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Тут з'являться товари, які добре продаються, але їх лишилось мало на складі.</p> : (
            <ul className="divide-y divide-border">{inv.lowStockBestsellers.slice(0, 6).map((p) => (
              <li key={p.id}><Link href={`/admin/products?q=${encodeURIComponent(p.sku)}`} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/40" data-testid={`link-lowstock-${p.id}`}>
                <ProductImage src={p.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg" imgClassName="p-0.5" />
                <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{p.name}</div><div className="font-mono text-[10px] text-muted-foreground">продано {p.salesCount}</div></div>
                <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{p.inStock ? (p.stockQty ?? 0) : 0} шт</span>
              </Link></li>
            ))}</ul>
          )}
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><LineChart className="h-4 w-4 text-primary" />Ціни постачальника</span>} action={<Link href="/admin/prices" className="text-xs font-semibold text-primary" data-testid="link-dashboard-prices">Усі</Link>}>
          {pcLoading ? <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            : !pc || pc.items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Змін ще не було — перевіримо під час наступної синхронізації.</p> : (
              <ul className="divide-y divide-border">{pc.items.map((c) => (
                <li key={c.id}><Link href={`/admin/products?q=${encodeURIComponent(c.sku)}`} className="flex items-center gap-2 px-4 py-2 hover:bg-muted/40" data-testid={`link-dash-price-${c.id}`}>
                  <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{c.productName}</div><div className="font-mono text-[10px] text-muted-foreground">{uah(c.oldPrice)} → {uah(c.newPrice)} · {relTime(c.changedAt)}</div></div>
                  <ChangeBadge c={c} />
                </Link></li>
              ))}</ul>
            )}
        </Panel>
      </div>
    </div>
  );
}
