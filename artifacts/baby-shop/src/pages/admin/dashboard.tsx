import { PriceAccessBanner } from "@/components/admin/price-access-banner";
import { useState } from "react";
import { Link } from "wouter";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, CircleAlert, Package, RefreshCw, ShoppingCart } from "lucide-react";
import {
  useGetAdminDashboard, getGetAdminDashboardQueryKey, useGetAdminSalesChart, getGetAdminSalesChartQueryKey,
  useGetAdminTopProducts, getGetAdminTopProductsQueryKey, useGetAdminCategoryBreakdown, getGetAdminCategoryBreakdownQueryKey,
  useGetAdminActivity, getGetAdminActivityQueryKey, useGetSyncStatus, getGetSyncStatusQueryKey,
} from "@workspace/api-client-react";
import { PageHead, Panel, StatusPill } from "@/components/admin/admin-layout";
import { SyncButton } from "@/components/admin/sync-button";
import { InventoryPanels } from "@/components/admin/inventory-panels";
import { ProductImage } from "@/components/store/product-image";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTime, num, relTime, uah } from "@/lib/format";
import { cn } from "@/lib/utils";

function Kpi({ label, value, sub, delta, accent }: { label: string; value: string; sub?: string; delta?: number | null; accent?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4", accent ? "border-transparent bg-sidebar text-sidebar-foreground" : "border-card-border bg-card")}>
      <div className={cn("text-[11px] font-semibold uppercase tracking-wider", accent ? "text-sidebar-foreground/60" : "text-muted-foreground")}>{label}</div>
      <div className="mt-1.5 font-mono text-2xl font-semibold tabular" data-testid={`kpi-${label}`}>{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta !== undefined && delta !== null && <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold", delta >= 0 ? "bg-[hsl(160_45%_90%)] text-[hsl(165_55%_24%)]" : "bg-primary/15 text-primary")}>{delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(delta).toFixed(1)}%</span>}
        {sub && <span className={accent ? "text-sidebar-foreground/60" : "text-muted-foreground"}>{sub}</span>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const { data: d, isLoading, isError, refetch } = useGetAdminDashboard({ query: { queryKey: getGetAdminDashboardQueryKey() } });
  const { data: chart = [], isLoading: chartLoading } = useGetAdminSalesChart({ days }, { query: { queryKey: getGetAdminSalesChartQueryKey({ days }) } });
  const { data: top = [] } = useGetAdminTopProducts({ query: { queryKey: getGetAdminTopProductsQueryKey() } });
  const { data: cats = [] } = useGetAdminCategoryBreakdown({ query: { queryKey: getGetAdminCategoryBreakdownQueryKey() } });
  const { data: activity = [] } = useGetAdminActivity({ query: { queryKey: getGetAdminActivityQueryKey() } });
  const { data: sync } = useGetSyncStatus({ query: { queryKey: getGetSyncStatusQueryKey() } });

  if (isError) return <Panel><div className="p-10 text-center"><p className="font-semibold">Не вдалося завантажити статистику</p><button onClick={() => refetch()} className="mt-3 rounded-lg bg-foreground px-4 py-2 text-sm text-background" data-testid="button-retry-dashboard">Спробувати знову</button></div></Panel>;
  if (isLoading || !d) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div><Skeleton className="h-80 rounded-2xl" /></div>;

  const delta = d.revenuePrev30d > 0 ? ((d.revenue30d - d.revenuePrev30d) / d.revenuePrev30d) * 100 : null;
  const sc = d.statusCounts;
  const statusTotal = sc.new + sc.confirmed + sc.shipped + sc.delivered + sc.cancelled;
  const chartRevenue = chart.reduce((s, p) => s + p.revenue, 0);
  const chartOrders = chart.reduce((s, p) => s + p.orders, 0);
  const maxCatRev = Math.max(1, ...cats.map((c) => c.revenue));

  return (
    <div>
      <PageHead title="Огляд" sub={`Станом на ${dateTime(new Date().toISOString())}`} actions={<SyncButton running={sync?.running} />} />
      <PriceAccessBanner noPrice={d.productsNoPrice ?? 0} connected={!!sync?.supplierAccountConnected} />
      {d.productsTotal === 0 && (
        <div className="mb-4 flex flex-col items-start gap-3 rounded-2xl bg-secondary p-5 sm:flex-row sm:items-center">
          <Package className="h-8 w-8 shrink-0" />
          <div className="flex-1"><div className="font-display font-bold">Каталог поки порожній</div><p className="text-sm">Запустіть першу синхронізацію — товари зі складу toysi.ua з'являться в магазині автоматично.</p></div>
          <Link href="/admin/sync" className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-bold text-background" data-testid="link-first-sync">Перейти до синхронізації</Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi accent label="Виручка 30 днів" value={uah(d.revenue30d)} delta={delta} sub={`попер. ${uah(d.revenuePrev30d)}`} />
        <Kpi label="Прибуток 30 днів" value={uah(d.profit30d)} sub={d.revenue30d ? `маржа ${((d.profit30d / d.revenue30d) * 100).toFixed(1)}%` : undefined} />
        <Kpi label="Замовлень сьогодні" value={num(d.ordersToday)} sub={uah(d.revenueToday)} />
        <Kpi label="Середній чек" value={uah(d.avgOrderValue)} sub={`${num(d.orders30d)} за 30 дн`} />
        <Kpi label="Товарів у наявності" value={num(d.productsInStock)} sub={`з ${num(d.productsTotal)}`} />
        <Kpi label="Закінчились" value={num(d.productsOutOfStock)} sub={`приховано ${num(d.productsHidden)}`} />
        <Kpi label="Нових сьогодні" value={num(d.productsNewToday)} sub="товарів зі складу" />
        <Kpi label="Покупців" value={num(d.customersTotal)} sub={`всього ${num(d.ordersTotal)} замовл. · ${uah(d.revenueTotal)}`} />
      </div>

      <InventoryPanels />

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel title={<span className="flex items-baseline gap-3">Продажі <span className="font-mono text-xs font-normal text-muted-foreground tabular">{uah(chartRevenue)} · {chartOrders} замовл.</span></span>}
          action={<div className="flex rounded-lg bg-muted p-0.5">{[7, 30, 90].map((n) => <button key={n} type="button" onClick={() => setDays(n)} data-testid={`button-chart-${n}`} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", days === n ? "bg-card shadow-sm" : "text-muted-foreground")}>{n} дн</button>)}</div>}>
          <div className="h-72 p-2 pr-4 pt-4">
            {chartLoading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(14 88% 55%)" stopOpacity={0.35} /><stop offset="100%" stopColor="hsl(14 88% 55%)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="hsl(32 30% 90%)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(8, 10) + "." + v.slice(5, 7)} tick={{ fontSize: 11, fill: "hsl(285 10% 45%)" }} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis tickFormatter={(v: number) => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v))} tick={{ fontSize: 11, fill: "hsl(285 10% 45%)" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(32 30% 87%)", fontSize: 12 }} formatter={(v: number, n: string) => (n === "revenue" ? [uah(v), "Виручка"] : [v, "Замовлень"])} labelFormatter={(l: string) => l.split("-").reverse().join(".")} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(14 88% 55%)" strokeWidth={2.5} fill="url(#rev)" />
                  <Area type="monotone" dataKey="orders" stroke="hsl(285 35% 30%)" strokeWidth={1.5} fill="transparent" yAxisId={0} hide />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Статуси замовлень" action={<Link href="/admin/orders" className="text-xs font-semibold text-primary">Усі</Link>}>
            <div className="p-4">
              <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-muted">
                {statusTotal > 0 && (["new", "confirmed", "shipped", "delivered", "cancelled"] as const).map((s, i) => <div key={s} style={{ width: `${(sc[s] / statusTotal) * 100}%` }} className={["bg-primary", "bg-secondary", "bg-[hsl(262_55%_65%)]", "bg-[hsl(165_50%_40%)]", "bg-border"][i]} />)}
              </div>
              <div className="space-y-1.5">{(["new", "confirmed", "shipped", "delivered", "cancelled"] as const).map((s) => <Link key={s} href={`/admin/orders?status=${s}`} className="flex items-center justify-between rounded-lg px-1 py-0.5 hover:bg-muted"><StatusPill status={s} /><span className="font-mono text-sm tabular">{sc[s]}</span></Link>)}</div>
            </div>
          </Panel>
          <Panel title="Склад" action={<Link href="/admin/sync" className="text-xs font-semibold text-primary">Деталі</Link>}>
            <div className="space-y-3 p-4 text-sm">
              {d.lastSync ? (
                <>
                  <div className="flex items-center gap-2">{d.lastSync.status === "failed" ? <CircleAlert className="h-4 w-4 text-destructive" /> : d.lastSync.status === "running" ? <RefreshCw className="h-4 w-4 animate-spin text-primary" /> : <CheckCircle2 className="h-4 w-4 text-[hsl(165_55%_35%)]" />}<span className="font-semibold">{d.lastSync.status === "running" ? "Триває зараз" : `Остання: ${relTime(d.lastSync.finishedAt ?? d.lastSync.startedAt)}`}</span></div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular">
                    <div className="rounded-lg bg-muted p-2">+{d.lastSync.added} нових</div><div className="rounded-lg bg-muted p-2">{d.lastSync.updated} оновл.</div>
                    <div className="rounded-lg bg-muted p-2">−{d.lastSync.wentOutOfStock} закінч.</div><div className="rounded-lg bg-muted p-2">↺{d.lastSync.backInStock} повернул.</div>
                  </div>
                </>
              ) : <p className="text-muted-foreground">Синхронізацій ще не було.</p>}
              <SyncButton running={sync?.running} className="w-full" />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Топ товарів">
          {top.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Продажів ще немає</p> : (
            <ul className="divide-y divide-border">
              {top.slice(0, 8).map((t, i) => (
                <li key={(t.productId ?? "x") + "-" + i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-4 font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <ProductImage src={t.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg" imgClassName="p-0.5" />
                  <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium" title={t.name}>{t.name}</div><div className="font-mono text-[11px] text-muted-foreground">{t.quantity} шт</div></div>
                  <span className="font-mono text-xs font-semibold tabular">{uah(t.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Категорії">
          {cats.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Немає даних</p> : (
            <div className="h-[340px] overflow-y-auto p-2">
              <ResponsiveContainer width="100%" height={Math.max(300, Math.min(cats.length, 12) * 28)}>
                <BarChart data={cats.slice(0, 12)} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" hide domain={[0, maxCatRev]} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: "hsl(285 20% 30%)" }} axisLine={false} tickLine={false} tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "…" : v)} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [uah(v), "Виручка"]} />
                  <Bar dataKey="revenue" fill="hsl(285 35% 30%)" radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
              <table className="mt-2 w-full text-[11px]"><tbody>{cats.slice(0, 12).map((c) => <tr key={c.categoryId} className="border-t border-border"><td className="truncate py-1 pr-2">{c.name}</td><td className="text-right font-mono tabular text-muted-foreground">{c.inStockCount}/{c.productCount}</td></tr>)}</tbody></table>
            </div>
          )}
        </Panel>
        <Panel title="Стрічка подій">
          {activity.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Поки тихо</p> : (
            <ul className="max-h-[340px] divide-y divide-border overflow-y-auto">
              {activity.map((a) => {
                const Icon = a.type.startsWith("sync") ? RefreshCw : ShoppingCart;
                const body = (
                  <div className="flex gap-3 px-4 py-2.5 hover:bg-muted/50">
                    <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", a.type === "sync_failed" ? "bg-destructive/15 text-destructive" : a.type === "order_created" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}><Icon className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{a.title}</div>{a.subtitle && <div className="truncate text-[11px] text-muted-foreground">{a.subtitle}</div>}</div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{relTime(a.createdAt)}</span>
                  </div>
                );
                return <li key={a.id}>{a.orderId ? <Link href={`/admin/orders/${a.orderId}`} data-testid={`link-activity-${a.id}`}>{body}</Link> : body}</li>;
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
