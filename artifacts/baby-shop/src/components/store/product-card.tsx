import { useRef, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Check, Clock, Plus } from "lucide-react";
import type { Product } from "@workspace/api-client-react";
import { ProductImage } from "./product-image";
import { flyToCart, useCart } from "@/lib/cart";
import { ON_ORDER_TERM, isOnOrder, uah } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { add } = useCart();
  const btn = useRef<HTMLButtonElement>(null);
  const [added, setAdded] = useState(false);
  const discount = product.oldPrice && product.oldPrice > product.price ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!product.inStock) return;
    flyToCart(btn.current, product.imageUrl);
    add({ productId: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl, sku: product.sku, deliveryDays: product.deliveryDays });
    setAdded(true); setTimeout(() => setAdded(false), 1400);
  };
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: Math.min(index, 12) * 0.04, ease: [0.2, 0.7, 0.2, 1] }}
      className="group relative" data-testid={`card-product-${product.id}`}>
      <Link href={`/product/${product.id}`} className="flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-card-border bg-card transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_hsl(285_40%_20%/0.35)]">
        <div className="relative">
          <ProductImage src={product.imageUrl} alt={product.name} className="aspect-square" imgClassName="transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
            {product.isNew && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">новинка</span>}
            {discount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">−{discount}%</span>}
          </div>
          {product.inStock && isOnOrder(product.deliveryDays) && (
            <span className="absolute bottom-2 left-2.5 inline-flex items-center gap-1 rounded-full bg-[hsl(42_95%_88%)] px-2 py-0.5 text-[10px] font-bold text-[hsl(30_70%_26%)] shadow-sm" data-testid={`badge-on-order-${product.id}`}><Clock className="h-3 w-3" />Доставка {ON_ORDER_TERM}</span>
          )}
          {!product.inStock && <div className="absolute inset-0 flex items-end justify-center bg-card/50 pb-3"><span className="rounded-full bg-foreground/85 px-3 py-1 text-[11px] font-semibold text-background">Немає в наявності</span></div>}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
          {product.categoryName && <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{product.categoryName}</span>}
          <h3 className="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight sm:text-sm" title={product.name}>{product.name}</h3>
          <div className="mt-auto flex items-end justify-between gap-2 pt-1">
            <div className="leading-none">
              {discount > 0 && <div className="mb-1 text-[11px] text-muted-foreground line-through tabular">{uah(product.oldPrice)}</div>}
              <div className={cn("font-display text-base font-bold tabular sm:text-lg", discount > 0 && "text-primary")} data-testid={`text-price-${product.id}`}>{uah(product.price)}</div>
            </div>
            <button ref={btn} type="button" onClick={onAdd} disabled={!product.inStock} aria-label="Додати в кошик" data-testid={`button-add-${product.id}`}
              className={cn("relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all duration-200 active:scale-90 disabled:opacity-30",
                added ? "bg-[hsl(165_55%_38%)] text-white" : "bg-foreground text-background hover:bg-primary")}>
              {added ? <Check className="h-4 w-4" /> : <Plus className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-card-border bg-card">
      <div className="aspect-square animate-pulse bg-muted" />
      <div className="space-y-2 p-4">
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="flex items-center justify-between pt-2"><div className="h-5 w-20 animate-pulse rounded bg-muted" /><div className="h-10 w-10 animate-pulse rounded-full bg-muted" /></div>
      </div>
    </div>
  );
}
