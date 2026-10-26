import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";

export const productsTable = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    sku: text("sku").notNull().unique(),
    supplierProductId: text("supplier_product_id"),
    name: text("name").notNull(),
    article: text("article"),
    description: text("description"),
    images: text("images").array(),
    supplierUrl: text("supplier_url").notNull(),
    imageUrl: text("image_url"),
    image2Url: text("image2_url"),
    supplierPrice: numeric("supplier_price", { precision: 12, scale: 2, mode: "number" }),
    supplierOldPrice: numeric("supplier_old_price", { precision: 12, scale: 2, mode: "number" }),
    /** Guaranteed units: exact count, or the lower bound when the supplier shows a range ("10...50", "понад 100"). */
    stockQty: integer("stock_qty"),
    /** Upper bound of the supplier range; equals stockQty when exact; null when unknown. */
    stockQtyMax: integer("stock_qty_max"),
    /**
     * Supplier's delivery term in days for items shipped "під замовлення" from a partner warehouse
     * (listing shows "Термін доставки до N днів"). null = on the supplier's own warehouse, ships right away.
     */
    deliveryDays: integer("delivery_days"),
    priceOverride: numeric("price_override", { precision: 12, scale: 2, mode: "number" }),
    categoryId: integer("category_id"),
    sourceCatId: text("source_cat_id"),
    inStock: boolean("in_stock").notNull().default(true),
    isNew: boolean("is_new").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    salesCount: integer("sales_count").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    seoUpdatedAt: timestamp("seo_updated_at", { withTimezone: true }),
    detailsFetchedAt: timestamp("details_fetched_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_stock_active_idx").on(t.inStock, t.isActive),
    index("products_first_seen_idx").on(t.firstSeenAt),
  ],
);

export type ProductRow = typeof productsTable.$inferSelect;

/** Supplier purchase price changes detected during sync. */
export const priceChangesTable = pgTable(
  "price_changes",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull(),
    oldPrice: numeric("old_price", { precision: 12, scale: 2, mode: "number" }).notNull(),
    newPrice: numeric("new_price", { precision: 12, scale: 2, mode: "number" }).notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_changes_changed_idx").on(t.changedAt), index("price_changes_product_idx").on(t.productId)],
);
export type PriceChangeRow = typeof priceChangesTable.$inferSelect;
