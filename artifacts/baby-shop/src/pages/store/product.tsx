import { useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, PackageX, ShoppingBag, Truck, Zap } from "lucide-react";
import { useGetProduct, getGetProductQueryKey, useGetRelatedProducts, getGetRelatedProductsQueryKey } from "@workspace/api-client-react";
import { ProductImage } from "@/components/store/product-image";
import { ProductCard } from "@/components/store/product-card";
import { QtyStepper } from "@/components/store/cart-drawer";
import { StateBlock } from "@/components/store/store-layout";
import { flyToCart, useCart } from "@/lib/cart";
import { uah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSeo } from "@/lib/seo";

export default function ProductPage() {
  const { id: idStr } = useParams<{ id: string }>();
  const id = Number(idStr);
  const [, setLocation] = useLocation();
  const { data: p, isLoading, isError, refetch } = useGetProduct(id, { query: { enabled: !!id, queryKey: getGetProductQueryKey(id) } });
  const { data: related } = useGetRelatedProducts(id, { query: { enabled: !!id, queryKey: getGetRelatedProductsQueryKey(id) } });
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useSeo({
    title: p ? (p.seoTitle ?? `${p.name} — купити за ${p.price} грн | Пташеня`) : null,
    description: p?.seoDescription ?? null,
    image: p?.imageUrl ?? null,
    path: `/product/${id}`,
    jsonLd: p
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.name,
          sku: p.sku,
          ...(p.article ? { mpn: p.article } : {}),
          image: p.images.length ? p.images : p.imageUrl ? [p.imageUrl] : [],
          ...(p.description ? { description: p.description.slice(0, 5000) } : {}),
          ...(p.categoryName ? { category: p.categoryName } : {}),
          offers: {
            "@type": "Offer",
            price: p.price,
            priceCurrency: "UAH",
            availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: window.location.href,
          },
        }
      : null,
  });

  if (isLoading) return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-8 md:grid-cols-2">
      <div className="aspect-square animate-pulse rounded-[2rem] bg-muted" />
      <div className="space-y-4"><div className="h-4 w-1/3 animate-pulse rounded bg-muted" /><div className="h-10 w-full animate-pulse rounded bg-muted" /><div className="h-10 w-2/3 animate-pulse rounded bg-muted" /><div className="h-14 w-40 animate-pulse rounded bg-muted" /><div className="h-14 w-full animate-pulse rounded-full bg-muted" /></div>
    </div>
  );
  if (isError || !p) return <StateBlock title="Такого товару немає" text="Можливо, його вже розкупили або посилання застаріло." action={<div className="flex gap-2"><button onClick={() => refetch()} className="rounded-full border border-border px-5 py-3 font-semibold" data-testid="button-retry-product">Ще раз</button><Link href="/catalog" className="rounded-full bg-foreground px-6 py-3 font-semibold text-background">До каталогу</Link></div>} />;

  const images = p.images.length ? p.images : p.imageUrl ? [p.imageUrl] : [];
  const discount = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const item = { productId: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl, sku: p.sku };
  const onAdd = () => { flyToCart(btn.current, p.imageUrl); add(item, qty); setAdded(true); setTimeout(() => setAdded(false), 1600); };
  const onBuy = () => { add(item, qty); setLocation("/checkout"); };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6">
      <nav className="mb-5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Головна</Link>
        <ChevronRight className="h-3 w-3" /><Link href="/catalog" className="hover:text-foreground">Каталог</Link>
        {p.breadcrumbs.map((b) => <span key={b.id} className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /><Link href={`/catalog/${b.id}`} className="hover:text-foreground" data-testid={`link-crumb-${b.id}`}>{b.name}</Link></span>)}
      </nav>
      <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
        <div className="md:sticky md:top-24 md:self-start">
          <div className="relative overflow-hidden rounded-[2rem] border border-card-border bg-card">
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <ProductImage src={images[active] ?? null} alt={p.name} className="aspect-square" imgClassName="p-6" />
              </motion.div>
            </AnimatePresence>
            <div className="absolute left-4 top-4 flex flex-col gap-1.5">
              {p.isNew && <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wider">новинка</span>}
              {discount > 0 && <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">−{discount}%</span>}
            </div>
          </div>
          {images.length > 1 && (
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
              {images.map((src, i) => <button key={src + i} type="button" onClick={() => setActive(i)} data-testid={`button-thumb-${i}`} className={cn("shrink-0 overflow-hidden rounded-2xl border-2 transition", i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}><ProductImage src={src} alt="" className="h-20 w-20" /></button>)}
            </div>
          )}
        </div>
        <div>
          {p.categoryName && <Link href={`/catalog/${p.categoryId}`} className="text-xs font-bold uppercase tracking-widest text-primary">{p.categoryName}</Link>}
          <h1 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl" data-testid="text-product-name">{p.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>Код: {p.sku}</span>{p.article && <span>Артикул: {p.article}</span>}</div>
          <div className="mt-6 flex items-end gap-3">
            <span className={cn("font-display text-4xl font-extrabold tabular", discount > 0 && "text-primary")} data-testid="text-product-price">{uah(p.price)}</span>
            {discount > 0 && <span className="mb-1 text-lg text-muted-foreground line-through tabular">{uah(p.oldPrice)}</span>}
          </div>
          <div className="mt-3">
            {p.inStock
              ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(160_45%_90%)] px-3 py-1 text-xs font-bold text-[hsl(165_55%_24%)]" data-testid="status-stock"><span className="h-1.5 w-1.5 rounded-full bg-current" />{p.stockQty != null && p.stockQtyMax === p.stockQty && p.stockQty <= 5 ? `Лишилось ${p.stockQty} шт.` : "Є в наявності"}</span>
              : <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground" data-testid="status-stock"><PackageX className="h-3.5 w-3.5" />Немає в наявності</span>}
          </div>
          {p.inStock && (
            <div className="mt-6 space-y-3">
              <div className="flex gap-3">
                <QtyStepper size="lg" value={qty} onChange={(n) => setQty(Math.max(1, Math.min(p.stockQty ?? 999, n)))} />
                <button ref={btn} type="button" onClick={onAdd} data-testid="button-add-to-cart" className={cn("flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-base font-bold transition active:scale-[.97]", added ? "bg-[hsl(165_55%_38%)] text-white" : "bg-foreground text-background hover:bg-foreground/90")}>
                  {added ? <><Check className="h-5 w-5" />Додано</> : <><ShoppingBag className="h-5 w-5" />У кошик</>}
                </button>
              </div>
              <button type="button" onClick={onBuy} data-testid="button-buy-now" className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-primary-foreground shadow-[0_14px_30px_-12px_hsl(14_88%_45%/.6)] transition active:scale-[.98]"><Zap className="h-5 w-5" />Купити зараз</button>
            </div>
          )}
          <div className="mt-6 grid gap-2 rounded-[1.4rem] bg-muted/60 p-4 text-sm">
            <div className="flex gap-3"><Truck className="h-5 w-5 shrink-0 text-primary" /><span>Відправка Новою Поштою, Укрпоштою, кур'єром або самовивіз</span></div>
            <div className="flex gap-3"><Check className="h-5 w-5 shrink-0 text-primary" /><span>Оплата при отриманні або на карту</span></div>
          </div>
          {p.description && (
            <div className="mt-8">
              <h2 className="mb-3 font-display text-lg font-bold">Опис</h2>
              <div className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/80" data-testid="text-description">{p.description}</div>
            </div>
          )}
        </div>
      </div>
      {related && related.length > 0 && (
        <section className="pt-16">
          <h2 className="mb-5 font-display text-2xl font-bold">Може знадобитися ще</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">{related.slice(0, 10).map((r, i) => <ProductCard key={r.id} product={r} index={i} />)}</div>
        </section>
      )}
    </div>
  );
}
