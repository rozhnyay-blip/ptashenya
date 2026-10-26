import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, PackageOpen, Pencil, Search, Star, X } from "lucide-react";
import { useListAdminProducts, getListAdminProductsQueryKey, useUpdateAdminProduct, useListCategories, getGetAdminDashboardQueryKey, getGetStorefrontHighlightsQueryKey, type AdminProduct, type AdminProductPage, type ListAdminProductsParams, type ListAdminProductsStock, type ProductUpdate } from "@workspace/api-client-react";
import { PageHead, Panel } from "@/components/admin/admin-layout";
import { Pager } from "@/components/admin/pager";
import { ProductImage } from "@/components/store/product-image";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiError, uah } from "@/lib/format";
import { cn } from "@/lib/utils";

const STOCKS: { v: ListAdminProductsStock; l: string }[] = [{ v: "all", l: "Усі" }, { v: "in_stock", l: "В наявності" }, { v: "out_of_stock", l: "Закінчились" }, { v: "hidden", l: "Приховані" }];

function PriceCell({ p, onSave }: { p: AdminProduct; onSave: (v: number | null) => void }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState("");
  if (edit) return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(val.trim() ? Number(val.replace(",", ".")) : null); setEdit(false); }} className="flex items-center justify-end gap-1">
      <input autoFocus inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEdit(false)} placeholder="авто" data-testid={`input-price-${p.id}`} className="h-7 w-20 rounded-md border border-primary bg-background px-2 text-right font-mono text-xs outline-none" />
      <button type="submit" className="rounded-md bg-foreground px-2 py-1 text-[10px] font-bold text-background" data-testid={`button-save-price-${p.id}`}>OK</button>
    </form>
  );
  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" onClick={() => { setVal(p.priceOverride != null ? String(p.priceOverride) : ""); setEdit(true); }} data-testid={`button-edit-price-${p.id}`} className="group inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-sm font-semibold tabular hover:bg-muted">
        {uah(p.price)}<Pencil className="h-3 w-3 opacity-0 transition group-hover:opacity-50" />
      </button>
      {p.priceOverride != null && <button type="button" title="Повернути автоматичну ціну" onClick={() => onSave(null)} className="rounded bg-secondary px-1 text-[9px] font-bold uppercase" data-testid={`button-reset-price-${p.id}`}>ручна<X className="ml-0.5 inline h-2.5 w-2.5" /></button>}
    </div>
  );
}

export default function ProductsPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const sp = useMemo(() => new URLSearchParams(search), [search]);
  const q = sp.get("q") ?? "";
  const cat = sp.get("cat") ? Number(sp.get("cat")) : undefined;
  const stock = (sp.get("stock") as ListAdminProductsStock) || "all";
  const page = Number(sp.get("page") || 1);
  const [qIn, setQIn] = useState(q);
  useEffect(() => setQIn(q), [q]);
  const go = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams(search);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!("page" in patch)) n.delete("page");
    setLocation("/admin/products" + (n.toString() ? "?" + n : ""));
  };
  const params: ListAdminProductsParams = { search: q || undefined, categoryId: cat, stock, page, limit: 50 };
  const key = getListAdminProductsQueryKey(params);
  const { data, isLoading, isError, refetch, isFetching } = useListAdminProducts(params, { query: { queryKey: key, placeholderData: keepPreviousData } });
  const { data: cats = [] } = useListCategories();
  const qc = useQueryClient();
  const { toast } = useToast();
  const upd = useUpdateAdminProduct();
  const patch = (p: AdminProduct, data: ProductUpdate, msg: string) => {
    qc.setQueryData(key, (old: AdminProductPage | undefined) => old ? { ...old, items: old.items.map((x) => x.id === p.id ? { ...x, ...data, ...(data.priceOverride !== undefined && data.priceOverride !== null ? { price: data.priceOverride } : {}) } : x) } : old);
    upd.mutate({ id: p.id, data }, {
      onSuccess: () => { toast({ title: msg }); qc.invalidateQueries({ queryKey: getListAdminProductsQueryKey() }); qc.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetStorefrontHighlightsQueryKey() }); },
      onError: (e) => { toast({ title: "Не збережено", description: apiError(e).message, variant: "destructive" }); qc.invalidateQueries({ queryKey: key }); },
    });
  };
  const roots = cats.filter((c) => c.parentId === null);

  return (
    <div>
      <PageHead title="Товари" sub="Ціни розраховуються автоматично з націнкою. Клацніть на ціну, щоб задати вручну." />
      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="flex rounded-lg bg-muted p-0.5">{STOCKS.map((s) => <button key={s.v} type="button" onClick={() => go({ stock: s.v === "all" ? undefined : s.v })} data-testid={`tab-stock-${s.v}`} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", stock === s.v ? "bg-card shadow-sm" : "text-muted-foreground")}>{s.l}</button>)}</div>
          <select value={cat ?? ""} onChange={(e) => go({ cat: e.target.value || undefined })} data-testid="select-category" className="h-9 max-w-[220px] rounded-lg border border-border bg-background px-2 text-sm">
            <option value="">Усі категорії</option>
            {roots.map((r) => [<option key={r.id} value={r.id}>{r.name}</option>, ...cats.filter((c) => c.parentId === r.id).map((c) => <option key={c.id} value={c.id}>— {c.name}</option>)])}
          </select>
          <form onSubmit={(e) => { e.preventDefault(); go({ q: qIn.trim() || undefined }); }} className="relative ml-auto w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={qIn} onChange={(e) => setQIn(e.target.value)} placeholder="Назва або код" data-testid="input-products-search" className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </form>
        </div>
        {isError ? <div className="p-10 text-center text-sm">Помилка завантаження. <button className="font-semibold text-primary" onClick={() => refetch()} data-testid="button-retry-products">Повторити</button></div>
          : isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-14 text-center"><PackageOpen className="h-10 w-10 text-muted-foreground" /><div className="font-semibold">{q || cat || stock !== "all" ? "Нічого не знайдено" : "Товарів ще немає"}</div><p className="text-sm text-muted-foreground">{q || cat || stock !== "all" ? "Змініть фільтри." : "Запустіть синхронізацію, щоб імпортувати товари зі складу."}</p>{!(q || cat || stock !== "all") && <Link href="/admin/sync" className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground" data-testid="link-products-sync">До синхронізації</Link>}</div>
          ) : (
            <div className={cn("overflow-x-auto transition-opacity", isFetching && "opacity-60")}>
              <table className="w-full min-w-[980px] text-sm">
                <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-2">Товар</th><th className="px-2">Категорія</th><th className="px-2 text-center">Склад</th><th className="px-2 text-right">Закупка</th><th className="px-2 text-right">Продаж</th><th className="px-2 text-right">Маржа</th><th className="px-2 text-right">Продано</th><th className="px-2 text-center">Показ</th><th className="px-4 text-center">Топ</th></tr></thead>
                <tbody>{data.items.map((p) => {
                  const margin = p.supplierPrice ? p.price - p.supplierPrice : null;
                  return (
                    <tr key={p.id} className={cn("border-b border-border/70 hover:bg-muted/40", !p.isActive && "opacity-55")} data-testid={`row-product-${p.id}`}>
                      <td className="px-4 py-2"><div className="flex items-center gap-3"><ProductImage src={p.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg" imgClassName="p-0.5" /><div className="min-w-0 max-w-[340px]"><div className="truncate text-xs font-medium" title={p.name}>{p.name}</div><div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">{p.sku}{p.isNew && <span className="rounded bg-secondary px-1 font-sans font-bold text-secondary-foreground">NEW</span>}<a href={p.supplierUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-sans font-semibold text-primary hover:underline" data-testid={`link-supplier-${p.id}`}>toysi.ua<ExternalLink className="h-2.5 w-2.5" /></a></div></div></div></td>
                      <td className="max-w-[150px] truncate px-2 text-xs text-muted-foreground">{p.categoryName ?? "—"}</td>
                      <td className="px-2 text-center">{p.inStock ? <span className="inline-block h-2 w-2 rounded-full bg-[hsl(165_55%_38%)]" title="В наявності" /> : <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">нема</span>}</td>
                      <td className="px-2 text-right font-mono text-xs tabular text-muted-foreground">{uah(p.supplierPrice)}</td>
                      <td className="px-2"><PriceCell p={p} onSave={(v) => patch(p, { priceOverride: v }, v === null ? "Повернуто автоматичну ціну" : "Ціну оновлено")} /></td>
                      <td className={cn("px-2 text-right font-mono text-xs tabular", margin !== null && margin < 0 ? "text-destructive" : "text-[hsl(165_55%_30%)]")}>{margin !== null ? uah(margin) : "—"}</td>
                      <td className="px-2 text-right font-mono text-xs tabular">{p.salesCount}</td>
                      <td className="px-2 text-center"><Switch checked={p.isActive} onCheckedChange={(v) => patch(p, { isActive: v }, v ? "Товар показано" : "Товар приховано")} data-testid={`switch-active-${p.id}`} /></td>
                      <td className="px-4 text-center"><button type="button" onClick={() => patch(p, { isFeatured: !p.isFeatured }, p.isFeatured ? "Прибрано з обраного" : "Додано в обране на головній")} data-testid={`button-featured-${p.id}`} className="rounded-md p-1 hover:bg-muted"><Star className={cn("h-4 w-4", p.isFeatured ? "fill-secondary text-[hsl(40_90%_45%)]" : "text-muted-foreground")} /></button></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        {data && data.pages > 1 && <Pager page={page} pages={data.pages} total={data.total} onPage={(p) => go({ page: String(p) })} />}
      </Panel>
    </div>
  );
}
