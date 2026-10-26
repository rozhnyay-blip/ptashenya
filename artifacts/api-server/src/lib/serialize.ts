import type { ProductRow, OrderRow, OrderItemRow, SyncRunRow, SettingsRow } from "@workspace/db";
import { retailPrice } from "./settings";

export function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export function toProduct(
  p: ProductRow,
  s: Pick<SettingsRow, "markupPercent" | "roundPrices">,
  categoryName: string | null,
) {
  const price = retailPrice(p.supplierPrice, p.priceOverride, s);
  const old =
    p.priceOverride === null && p.supplierOldPrice !== null
      ? retailPrice(p.supplierOldPrice, null, s)
      : null;
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    price,
    oldPrice: old !== null && old > price ? old : null,
    inStock: p.inStock,
    stockQty: p.stockQty,
    isNew: p.isNew,
    isFeatured: p.isFeatured,
    imageUrl: p.imageUrl,
    image2Url: p.image2Url,
    categoryId: p.categoryId,
    categoryName,
  };
}

export function toAdminProduct(
  p: ProductRow,
  s: Pick<SettingsRow, "markupPercent" | "roundPrices">,
  categoryName: string | null,
) {
  const base = toProduct(p, s, categoryName);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const profitPerUnit = p.supplierPrice !== null && base.price > 0 ? round2(base.price - p.supplierPrice) : null;
  const qty = p.inStock ? (p.stockQty ?? null) : 0;
  return {
    ...base,
    profitPerUnit,
    stockValue: qty !== null && base.price > 0 ? round2(base.price * qty) : null,
    stockProfit: qty !== null && profitPerUnit !== null ? round2(profitPerUnit * qty) : null,
    seoTitle: p.seoTitle,
    supplierPrice: p.supplierPrice,
    priceOverride: p.priceOverride,
    isActive: p.isActive,
    supplierUrl: p.supplierUrl,
    salesCount: p.salesCount,
    firstSeenAt: p.firstSeenAt.toISOString(),
    lastSeenAt: iso(p.lastSeenAt),
  };
}

export function toOrder(o: OrderRow, includeProfit: boolean) {
  return {
    id: o.id,
    number: o.number,
    customerName: o.customerName,
    phone: o.phone,
    email: o.email,
    city: o.city,
    deliveryMethod: o.deliveryMethod,
    deliveryAddress: o.deliveryAddress,
    paymentMethod: o.paymentMethod,
    comment: o.comment,
    adminNote: includeProfit ? o.adminNote : null,
    status: o.status,
    total: o.total,
    profit: includeProfit && o.cost !== null ? Math.round((o.total - o.cost) * 100) / 100 : null,
    itemsCount: o.itemsCount,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

export function toOrderDetail(o: OrderRow, items: OrderItemRow[], includeProfit: boolean) {
  return {
    ...toOrder(o, includeProfit),
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.name,
      sku: i.sku,
      imageUrl: i.imageUrl,
      price: i.price,
      supplierPrice: includeProfit ? i.supplierPrice : null,
      quantity: i.quantity,
      lineTotal: Math.round(i.price * i.quantity * 100) / 100,
    })),
  };
}

export function toSyncRun(r: SyncRunRow) {
  return {
    id: r.id,
    status: r.status,
    trigger: r.trigger,
    startedAt: r.startedAt.toISOString(),
    finishedAt: iso(r.finishedAt),
    pagesScanned: r.pagesScanned,
    pagesTotal: r.pagesTotal,
    productsSeen: r.productsSeen,
    added: r.added,
    updated: r.updated,
    wentOutOfStock: r.wentOutOfStock,
    backInStock: r.backInStock,
    currentStep: r.currentStep,
    errorMessage: r.errorMessage,
  };
}
