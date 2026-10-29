import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { useListCategories, useListProducts, getListProductsQueryKey, type Category, type ListProductsParams, type ListProductsSort } from "@workspace/api-client-react";
import { ProductCard, ProductCardSkeleton } from "@/components/store/product-card";
import { StateBlock } from "@/components/store/store-layout";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { num, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlsoSearched, aliasesFor, useAliasGroups } from "@/components/store/search-aliases";
import { useSeo } from "@/lib/seo";

const SORTS: { v: ListProductsSort; l: string }[] = [{ v: "popular", l: "Популярні" }, { v: "newest", l: "Новинки" }, { v: "price_asc", l: "Дешевші" }, { v: "price_desc", l: "Дорожчі" }, { v: "name", l: "За назвою" }];
const LIMIT = 24;

function CategoryTree({ cats, active, onPick }: { cats: Category[]; active?: number; onPick: (id?: number) => void }) {
  const roots = cats.filter((c) => c.parentId === null);
  const childrenOf = (id: number) => cats.filter((c) => c.parentId === id);
  const activeCat = cats.find((c) => c.id === active);
  const openRoot = activeCat ? (activeCat.parentId ?? activeCat.id) : undefined;
  const [expanded, setExpanded] = useState<number | undefined>(openRoot);
  useEffect(() => setExpanded(openRoot), [openRoot]);
  return (
    <div className="space-y-0.5">
      <button type="button" onClick={() => onPick(undefined)} data-testid="button-cat-all" className={cn("w-full rounded-xl px-3 py-2 text-left text-sm font-semibold", !active ? "bg-foreground text-background" : "hover:bg-muted")}>Усі товари</button>
      {roots.map((r) => {
        const kids = childrenOf(r.id);
        const isOpen = expanded === r.id;
        return (
          <div key={r.id}>
            <div className={cn("flex items-center rounded-xl", active === r.id ? "bg-foreground text-background" : "hover:bg-muted")}>
              <button type="button" onClick={() => onPick(r.id)} data-testid={`button-cat-${r.id}`} className="flex-1 truncate px-3 py-2 text-left text-sm font-medium">{r.name} <span className="text-xs opacity-50 tabular">{r.productCount}</span></button>
              {kids.length > 0 && <button type="button" aria-label="Розгорнути" onClick={() => setExpanded(isOpen ? undefined : r.id)} className="px-2 py-2"><ChevronDown className={cn("h-4 w-4 transition", isOpen && "rotate-180")} /></button>}
            </div>
            {isOpen && kids.length > 0 && (
              <div className="ml-3 border-l-2 border-border pl-2">
                {kids.map((k) => (
                  <button key={k.id} type="button" onClick={() => onPick(k.id)} data-testid={`button-cat-${k.id}`} className={cn("block w-full truncate rounded-lg px-3 py-1.5 text-left text-[13px]", active === k.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{k.name} <span className="opacity-60 tabular">{k.productCount}</span></button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CatalogPage() {
  const params = useParams<{ categoryId?: string }>();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const sp = useMemo(() => new URLSearchParams(search), [search]);
  const categoryId = params.categoryId ? Number(params.categoryId) : sp.get("category") ? Number(sp.get("category")) : undefined;
  const q = sp.get("search") ?? "";
  const minPrice = sp.get("min") ? Number(sp.get("min")) : undefined;
  const maxPrice = sp.get("max") ? Number(sp.get("max")) : undefined;
  const onlyNew = sp.get("onlyNew") === "1";
  const sort = (sp.get("sort") as ListProductsSort) || "popular";
  const page = Math.max(1, Number(sp.get("page") || 1));

  const [qInput, setQInput] = useState(q);
  const [minIn, setMinIn] = useState(minPrice?.toString() ?? "");
  const [maxIn, setMaxIn] = useState(maxPrice?.toString() ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => setQInput(q), [q]);
  useEffect(() => { setMinIn(minPrice?.toString() ?? ""); setMaxIn(maxPrice?.toString() ?? ""); }, [minPrice, maxPrice]);

  const update = (patch: Record<string, string | undefined>, opts: { cat?: number | null } = {}) => {
    const next = new URLSearchParams(search);
    next.delete("category");
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    const cat = opts.cat === undefined ? categoryId : opts.cat ?? undefined;
    const qs = next.toString();
    setLocation((cat ? `/catalog/${cat}` : "/catalog") + (qs ? "?" + qs : ""));
  };

  const queryParams: ListProductsParams = { search: q || undefined, categoryId, minPrice, maxPrice, onlyNew: onlyNew || undefined, sort, page, limit: LIMIT };
  const { data, isLoading, isFetching, isError, refetch } = useListProducts(queryParams, { query: { queryKey: getListProductsQueryKey(queryParams), placeholderData: keepPreviousData } });
  const { data: cats = [] } = useListCategories();
  const cat = cats.find((c) => c.id === categoryId);
  const aliasGroups = useAliasGroups();
  const catAliases = aliasesFor(cat?.name, aliasGroups);
  useSeo({
    title: cat ? `${cat.name} — купити в інтернет-магазині Пташеня` : q ? `Пошук «${q}» — Пташеня` : "Каталог товарів для дітей — Пташеня",
    description: cat
      ? `${cat.name}: ${cat.productCount} товарів у наявності за доступними цінами.${catAliases.length ? ` Також шукають: ${catAliases.join(", ")}.` : ""} Доставка Новою Поштою по всій Україні.`
      : null,
    path: categoryId ? `/catalog/${categoryId}` : "/catalog",
  });
  const parent = cat?.parentId ? cats.find((c) => c.id === cat.parentId) : undefined;
  const subcats = cat ? cats.filter((c) => c.parentId === cat.id) : cats.filter((c) => c.parentId === null);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [page]);

  const applyPrice = () => update({ min: minIn || undefined, max: maxIn || undefined });
  const activeChips = [
    q && { k: "search", l: `«${q}»` },
    onlyNew && { k: "onlyNew", l: "Тільки новинки" },
    (minPrice || maxPrice) && { k: "price", l: `${minPrice ?? 0} – ${maxPrice ?? "∞"} ₴` },
  ].filter(Boolean) as { k: string; l: string }[];

  const filters = (
    <div className="space-y-7">
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Категорії</div>
        <CategoryTree cats={cats} active={categoryId} onPick={(id) => { update({}, { cat: id ?? null }); setFiltersOpen(false); }} />
      </div>
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Ціна, ₴</div>
        <form onSubmit={(e) => { e.preventDefault(); applyPrice(); setFiltersOpen(false); }} className="flex items-center gap-2">
          <input inputMode="numeric" value={minIn} onChange={(e) => setMinIn(e.target.value.replace(/\D/g, ""))} placeholder="від" data-testid="input-min-price" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary" />
          <span className="text-muted-foreground">–</span>
          <input inputMode="numeric" value={maxIn} onChange={(e) => setMaxIn(e.target.value.replace(/\D/g, ""))} placeholder="до" data-testid="input-max-price" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary" />
          <button type="submit" data-testid="button-apply-price" className="h-11 shrink-0 rounded-xl bg-foreground px-3 text-sm font-semibold text-background">OK</button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[[0, 200], [200, 500], [500, 1000], [1000, 0]].map(([a, b]) => (
            <button key={a + "-" + b} type="button" onClick={() => { update({ min: a ? String(a) : undefined, max: b ? String(b) : undefined }); setFiltersOpen(false); }} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:border-foreground" data-testid={`button-price-preset-${a}`}>{b ? (a ? `${a}–${b}` : `до ${b}`) : `від ${a}`}</button>
          ))}
        </div>
      </div>
      <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-secondary/50 px-4 py-3">
        <span className="text-sm font-semibold">Тільки новинки</span>
        <Switch checked={onlyNew} onCheckedChange={(v) => update({ onlyNew: v ? "1" : undefined })} data-testid="switch-only-new" />
      </label>
    </div>
  );

  const pages = data?.pages ?? 1;
  const pageNums = useMemo(() => {
    const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
    return Array.from(set).sort((a, b) => a - b);
  }, [page, pages]);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6">
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Головна</Link><ChevronRight className="h-3 w-3" />
        <Link href="/catalog" className="hover:text-foreground">Каталог</Link>
        {parent && <><ChevronRight className="h-3 w-3" /><Link href={`/catalog/${parent.id}`} className="hover:text-foreground">{parent.name}</Link></>}
      </nav>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{cat?.name ?? (q ? "Пошук" : "Каталог")}</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular" data-testid="text-total">{data ? `${num(data.total)} ${plural(data.total, "товар", "товари", "товарів")}` : "Рахуємо товари..."}</p>
          <AlsoSearched words={catAliases} className="mt-1 text-xs text-muted-foreground" />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); update({ search: qInput.trim() || undefined }); }} className="hidden w-80 md:block">
          <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Пошук у каталозі" data-testid="input-catalog-search" className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
        </form>
      </div>

      {subcats.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
          {subcats.map((c) => <Link key={c.id} href={`/catalog/${c.id}`} data-testid={`chip-subcat-${c.id}`} className="shrink-0 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:border-foreground">{c.name} <span className="text-muted-foreground tabular">{c.productCount}</span></Link>)}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block"><div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2">{filters}</div></aside>
        <div>
          <div className="sticky top-[118px] z-30 -mx-4 mb-4 flex items-center gap-2 bg-background/90 px-4 py-2 backdrop-blur md:top-[68px] lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0">
            <button type="button" onClick={() => setFiltersOpen(true)} data-testid="button-open-filters" className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background lg:hidden"><SlidersHorizontal className="h-4 w-4" />Фільтри{activeChips.length > 0 && <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px]">{activeChips.length}</span>}</button>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {SORTS.map((s) => <button key={s.v} type="button" onClick={() => update({ sort: s.v === "popular" ? undefined : s.v })} data-testid={`button-sort-${s.v}`} className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition", sort === s.v ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:border-foreground")}>{s.l}</button>)}
            </div>
          </div>
          {activeChips.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {activeChips.map((c) => <button key={c.k} type="button" onClick={() => update(c.k === "price" ? { min: undefined, max: undefined } : { [c.k]: undefined })} data-testid={`chip-filter-${c.k}`} className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">{c.l}<X className="h-3 w-3" /></button>)}
              <button type="button" onClick={() => setLocation(categoryId ? `/catalog/${categoryId}` : "/catalog")} className="text-xs font-semibold text-muted-foreground underline" data-testid="button-clear-filters">Скинути все</button>
            </div>
          )}

          {isError ? (
            <StateBlock title="Не вдалося завантажити товари" text="Можливо, пропав інтернет." action={<button onClick={() => refetch()} className="rounded-full bg-foreground px-6 py-3 font-semibold text-background" data-testid="button-retry-catalog">Спробувати знову</button>} />
          ) : isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">{Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)}</div>
          ) : data && data.items.length === 0 ? (
            activeChips.length || categoryId
              ? <StateBlock title="Нічого не знайшлося" text="Спробуйте інший запит або приберіть частину фільтрів." action={<button onClick={() => setLocation("/catalog")} className="rounded-full bg-foreground px-6 py-3 font-semibold text-background" data-testid="button-reset-empty">Показати всі товари</button>} />
              : <StateBlock title="Каталог оновлюється" text="Ми саме завантажуємо товари зі складу. Загляньте за кілька хвилин." />
          ) : (
            <div className={cn("grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 sm:gap-4 xl:grid-cols-4", isFetching && "opacity-60")}>
              {data?.items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          )}

          {data && pages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-1.5">
              <button type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} data-testid="button-prev-page" className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              {pageNums.map((n, i) => (
                <span key={n} className="flex items-center gap-1.5">
                  {i > 0 && n - pageNums[i - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
                  <button type="button" onClick={() => update({ page: n === 1 ? undefined : String(n) })} data-testid={`button-page-${n}`} className={cn("h-11 min-w-11 rounded-full px-3 text-sm font-bold tabular", n === page ? "bg-foreground text-background" : "hover:bg-muted")}>{n}</button>
                </span>
              ))}
              <button type="button" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })} data-testid="button-next-page" className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[2rem] bg-background px-5 pb-10">
          <SheetTitle className="font-display text-xl">Фільтри</SheetTitle>
          <SheetDescription className="mb-5 text-xs">Зміни застосовуються одразу</SheetDescription>
          <form onSubmit={(e) => { e.preventDefault(); update({ search: qInput.trim() || undefined }); setFiltersOpen(false); }} className="mb-6">
            <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Пошук" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary" data-testid="input-filter-search" />
          </form>
          {filters}
        </SheetContent>
      </Sheet>
    </div>
  );
}
