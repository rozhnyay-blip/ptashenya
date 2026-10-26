import { useState } from "react";
import { Link } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, LineChart } from "lucide-react";
import { useListAdminPriceChanges, getListAdminPriceChangesQueryKey, type ListAdminPriceChangesDirection, type PriceChange } from "@workspace/api-client-react";
import { PageHead, Panel } from "@/components/admin/admin-layout";
import { ProductImage } from "@/components/store/product-image";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTime, num, relTime, uah } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ChangeBadge({ c }: { c: PriceChange }) {
  const up = c.newPrice > c.oldPrice;
  return <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular", up ? "bg-primary/15 text-primary" : "bg-[hsl(160_45%_90%)] text-[hsl(165_55%_24%)]")}>{up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{up ? "+" : ""}{c.changePercent.toFixed(1)}%</span>;
}

const DIRS: { v: ListAdminPriceChangesDirection; l: string }[] = [{ v: "all", l: "Усі" }, { v: "up", l: "Подорожчали" }, { v: "down", l: "Подешевшали" }];

export default function PricesPage() {
  const [dir, setDir] = useState<ListAdminPriceChangesDirection>("all");
  const params = { direction: dir, limit: 200 };
  const { data, isLoading, isError, refetch, isFetching } = useListAdminPriceChanges(params, { query: { queryKey: getListAdminPriceChangesQueryKey(params), placeholderData: keepPreviousData } });

  return (
    <div>
      <PageHead title="Ціни постачальника" sub="Як змінювались закупівельні ціни після синхронізацій складу" />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-card-border bg-card p-4"><div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><ArrowUpRight className="h-3.5 w-3.5 text-primary" />Подорожчали за 30 днів</div><div className="mt-1 font-mono text-2xl font-semibold tabular" data-testid="text-up30d">{data ? num(data.up30d) : "—"}</div></div>
        <div className="rounded-2xl border border-card-border bg-card p-4"><div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><ArrowDownRight className="h-3.5 w-3.5 text-[hsl(165_55%_30%)]" />Подешевшали за 30 днів</div><div className="mt-1 font-mono text-2xl font-semibold tabular" data-testid="text-down30d">{data ? num(data.down30d) : "—"}</div></div>
      </div>
      <Panel>
        <div className="flex border-b border-border p-3"><div className="flex rounded-lg bg-muted p-0.5">{DIRS.map((d) => <button key={d.v} type="button" onClick={() => setDir(d.v)} data-testid={`tab-direction-${d.v}`} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", dir === d.v ? "bg-card shadow-sm" : "text-muted-foreground")}>{d.l}</button>)}</div></div>
        {isError ? <div className="p-10 text-center text-sm">Помилка завантаження. <button className="font-semibold text-primary" onClick={() => refetch()} data-testid="button-retry-prices">Повторити</button></div>
          : isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          : !data || data.items.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-14 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-muted"><LineChart className="h-7 w-7 text-muted-foreground" /></div>
              <div className="font-display font-bold">{dir === "all" ? "Змін цін поки немає" : "Таких змін немає"}</div>
              <p className="text-sm text-muted-foreground">Під час щоденної синхронізації ми порівнюємо закупівельні ціни toysi.ua з попередніми. Щойно постачальник щось подорожчає чи подешевшає — це з'явиться тут, і ви вирішите, чи коригувати свою ціну.</p>
              <Link href="/admin/sync" className="rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background" data-testid="link-prices-sync">До синхронізації</Link>
            </div>
          ) : (
            <div className={cn("overflow-x-auto transition-opacity", isFetching && "opacity-60")}>
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-2">Товар</th><th className="px-2 text-right">Було</th><th className="px-2 text-right">Стало</th><th className="px-2 text-right">Зміна</th><th className="px-2 text-right">Ваша ціна</th><th className="px-4 text-right">Коли</th></tr></thead>
                <tbody>{data.items.map((c) => (
                  <tr key={c.id} className="border-b border-border/70 hover:bg-muted/40" data-testid={`row-price-${c.id}`}>
                    <td className="px-4 py-2"><Link href={`/admin/products?q=${encodeURIComponent(c.sku)}`} className="flex items-center gap-3" data-testid={`link-price-product-${c.id}`}><ProductImage src={c.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg" imgClassName="p-0.5" /><div className="min-w-0 max-w-[340px]"><div className="truncate text-xs font-medium hover:text-primary" title={c.productName}>{c.productName}</div><div className="font-mono text-[10px] text-muted-foreground">{c.sku}{!c.inStock && " · нема в наявності"}</div></div></Link></td>
                    <td className="px-2 text-right font-mono text-xs tabular text-muted-foreground line-through decoration-1">{uah(c.oldPrice)}</td>
                    <td className="px-2 text-right font-mono text-xs font-semibold tabular">{uah(c.newPrice)}</td>
                    <td className="px-2 text-right"><ChangeBadge c={c} /></td>
                    <td className="px-2 text-right font-mono text-xs tabular">{uah(c.retailPrice)}</td>
                    <td className="whitespace-nowrap px-4 text-right text-xs text-muted-foreground" title={dateTime(c.changedAt)}>{relTime(c.changedAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
      </Panel>
    </div>
  );
}
