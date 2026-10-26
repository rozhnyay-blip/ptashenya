import { Link } from "wouter";
import { Flame, LineChart, Warehouse } from "lucide-react";
import { useGetAdminInventory, getGetAdminInventoryQueryKey, useListAdminPriceChanges, getListAdminPriceChangesQueryKey } from "@workspace/api-client-react";
import { Panel } from "@/components/admin/admin-layout";
import { ProductImage } from "@/components/store/product-image";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangeBadge } from "@/pages/admin/prices";
import { num, pct, relTime, uah, uahCompact } from "@/lib/format";

export function InventoryPanels() {
  const { data: inv, isLoading, isError, refetch } = useGetAdminInventory({ query: { queryKey: getGetAdminInventoryQueryKey() } });
  const pp = { limit: 5 };
  const { data: pc, isLoading: pcLoading } = useListAdminPriceChanges(pp, { query: { queryKey: getListAdminPriceChangesQueryKey(pp) } });

  if (isError) return <Panel className="mt-4"><div className="p-6 text-center text-sm">Не вдалося порахувати склад. <button className="font-semibold text-primary" onClick={() => refetch()} data-testid="button-retry-inventory">Повторити</button></div></Panel>;
  if (isLoading || !inv) return <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]"><Skeleton className="h-80 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>;
  const cats = [...inv.categories].sort((a, b) => b.profit - a.profit);
  const maxR = Math.max(1, ...cats.map((c) => c.retailValue));

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
      <Panel title={<span className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-primary" />Вартість складу постачальника</span>} action={<Link href="/admin/products?stock=in_stock&sort=profit_desc" className="text-xs font-semibold text-primary" data-testid="link-inventory-products">До товарів</Link>}>
        <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
          {[
            ["Закупка", inv.costValue, `${num(inv.positionsInStock)} поз. · ${num(inv.unitsInStock)} шт`],
            ["Виручка", inv.retailValue, `націнка ${pct(inv.markupPercent, 0)}`],
            ["Прибуток", inv.profit, `маржа ${pct(inv.marginPercent)}`],
          ].map(([l, v, sub], i) => (
            <div key={l as string} className={i === 2 ? "col-span-2 bg-[hsl(160_45%_93%)] p-4 text-[hsl(165_55%_20%)] sm:col-span-2" : "bg-card p-4"}>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{l}</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular" title={uah(v as number)} data-testid={`text-inventory-${i}`}>≈ {uahCompact(v as number)}</div>
              <div className="text-[11px] opacity-70">{sub}</div>
            </div>
          ))}
        </div>
        {cats.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Товарів у наявності немає</p> : (
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card"><tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-2">Категорія</th><th className="hidden px-2 text-right sm:table-cell">Шт</th><th className="px-2 text-right">Виручка</th><th className="px-4 text-right">Прибуток</th></tr></thead>
              <tbody>{cats.map((c) => (
                <tr key={c.categoryId} className="border-t border-border/70 hover:bg-muted/40">
                  <td className="px-4 py-1.5"><Link href={`/admin/products?cat=${c.categoryId}&stock=in_stock`} className="block" data-testid={`link-inv-cat-${c.categoryId}`}><div className="truncate font-medium">{c.name}</div><div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[hsl(285_35%_30%)]" style={{ width: `${(c.retailValue / maxR) * 100}%` }} /></div></Link></td>
                  <td className="hidden px-2 text-right font-mono tabular text-muted-foreground sm:table-cell">{num(c.units)}</td>
                  <td className="px-2 text-right font-mono tabular" title={uah(c.retailValue)}>{uahCompact(c.retailValue)}</td>
                  <td className="px-4 text-right font-mono font-semibold tabular text-[hsl(165_55%_28%)]" title={uah(c.profit)}>{uahCompact(c.profit)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">Якщо продати весь доступний залишок. Кількість у постачальника частково обмежена, тож суми приблизні.</p>
      </Panel>
      <div className="space-y-4">
        <Panel title={<span className="flex items-center gap-2"><Flame className="h-4 w-4 text-primary" />Хіти, що закінчуються</span>}>
          {inv.lowStockBestsellers.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Тут з'являться товари, які добре продаються, але їх лишилось мало на складі.</p> : (
            <ul className="divide-y divide-border">{inv.lowStockBestsellers.slice(0, 6).map((p) => (
              <li key={p.id}><Link href={`/admin/products?q=${encodeURIComponent(p.sku)}`} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/40" data-testid={`link-lowstock-${p.id}`}>
                <ProductImage src={p.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg" imgClassName="p-0.5" />
                <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{p.name}</div><div className="font-mono text-[10px] text-muted-foreground">продано {p.salesCount}</div></div>
                <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{p.stockQty ?? 0} шт</span>
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
