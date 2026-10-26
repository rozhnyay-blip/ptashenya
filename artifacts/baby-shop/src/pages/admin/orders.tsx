import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { Inbox, Search } from "lucide-react";
import { useListAdminOrders, getListAdminOrdersQueryKey, type ListAdminOrdersParams, type OrderStatus } from "@workspace/api-client-react";
import { PageHead, Panel, StatusPill } from "@/components/admin/admin-layout";
import { Pager } from "@/components/admin/pager";
import { Skeleton } from "@/components/ui/skeleton";
import { DELIVERY_LABEL, PAYMENT_LABEL, STATUS_LABEL, dateTime, uah } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS: (OrderStatus | "all")[] = ["all", "new", "confirmed", "shipped", "delivered", "cancelled"];

export default function OrdersPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const sp = useMemo(() => new URLSearchParams(search), [search]);
  const status = (sp.get("status") as OrderStatus | null) ?? undefined;
  const q = sp.get("q") ?? "";
  const page = Number(sp.get("page") || 1);
  const [qIn, setQIn] = useState(q);
  useEffect(() => setQIn(q), [q]);
  const go = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams(search);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!("page" in patch)) n.delete("page");
    setLocation("/admin/orders" + (n.toString() ? "?" + n : ""));
  };
  const params: ListAdminOrdersParams = { status, search: q || undefined, page, limit: 30 };
  const { data, isLoading, isError, refetch, isFetching } = useListAdminOrders(params, { query: { queryKey: getListAdminOrdersQueryKey(params), placeholderData: keepPreviousData, refetchInterval: 30000 } });
  const counts = data?.statusCounts;
  const all = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;

  return (
    <div>
      <PageHead title="Замовлення" sub="Нові замовлення з'являються автоматично" />
      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const c = t === "all" ? all : counts?.[t];
              const on = (t === "all" && !status) || t === status;
              return <button key={t} type="button" onClick={() => go({ status: t === "all" ? undefined : t })} data-testid={`tab-status-${t}`} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold", on ? "bg-foreground text-background" : "hover:bg-muted")}>{t === "all" ? "Усі" : STATUS_LABEL[t]}{c !== undefined && <span className={cn("rounded-md px-1.5 font-mono text-[10px]", on ? "bg-background/20" : "bg-muted", t === "new" && c > 0 && !on && "bg-primary text-primary-foreground")}>{c}</span>}</button>;
            })}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); go({ q: qIn.trim() || undefined }); }} className="relative ml-auto w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={qIn} onChange={(e) => setQIn(e.target.value)} placeholder="№, ім'я або телефон" data-testid="input-orders-search" className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </form>
        </div>
        {isError ? <div className="p-10 text-center text-sm">Помилка завантаження. <button className="font-semibold text-primary" onClick={() => refetch()} data-testid="button-retry-orders">Повторити</button></div>
          : isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
          : !data || data.items.length === 0 ? <div className="flex flex-col items-center gap-2 p-14 text-center"><Inbox className="h-10 w-10 text-muted-foreground" /><div className="font-semibold">Замовлень не знайдено</div><p className="text-sm text-muted-foreground">{q || status ? "Спробуйте змінити фільтри." : "Щойно хтось оформить замовлення — воно з'явиться тут."}</p></div>
          : (
            <div className={cn("overflow-x-auto transition-opacity", isFetching && "opacity-60")}>
              <table className="w-full min-w-[860px] text-sm">
                <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-2 font-semibold">№</th><th className="px-2 font-semibold">Дата</th><th className="px-2 font-semibold">Клієнт</th><th className="px-2 font-semibold">Доставка</th><th className="px-2 font-semibold">Оплата</th><th className="px-2 font-semibold">Статус</th><th className="px-2 text-right font-semibold">Товарів</th><th className="px-2 text-right font-semibold">Сума</th><th className="px-4 text-right font-semibold">Прибуток</th></tr></thead>
                <tbody>
                  {data.items.map((o) => (
                    <tr key={o.id} onClick={() => setLocation(`/admin/orders/${o.id}`)} data-testid={`row-order-${o.id}`} className={cn("cursor-pointer border-b border-border/70 hover:bg-muted/50", o.status === "new" && "bg-primary/[0.04]")}>
                      <td className="px-4 py-2.5"><Link href={`/admin/orders/${o.id}`} className="font-mono font-semibold" onClick={(e) => e.stopPropagation()}>{o.number}</Link></td>
                      <td className="whitespace-nowrap px-2 text-xs text-muted-foreground">{dateTime(o.createdAt)}</td>
                      <td className="px-2"><div className="max-w-[180px] truncate font-medium">{o.customerName}</div><div className="font-mono text-[11px] text-muted-foreground">{o.phone}</div></td>
                      <td className="px-2 text-xs"><div>{DELIVERY_LABEL[o.deliveryMethod]}</div><div className="max-w-[160px] truncate text-muted-foreground">{o.city}</div></td>
                      <td className="px-2 text-xs">{PAYMENT_LABEL[o.paymentMethod]}</td>
                      <td className="px-2"><StatusPill status={o.status} /></td>
                      <td className="px-2 text-right font-mono tabular">{o.itemsCount}</td>
                      <td className="px-2 text-right font-mono font-semibold tabular">{uah(o.total)}</td>
                      <td className="px-4 text-right font-mono text-xs tabular text-[hsl(165_55%_30%)]">{o.profit != null ? uah(o.profit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        {data && data.pages > 1 && <Pager page={page} pages={data.pages} total={data.total} onPage={(p) => go({ page: String(p) })} />}
      </Panel>
    </div>
  );
}
