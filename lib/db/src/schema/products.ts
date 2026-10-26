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
    stockQty: integer("stock_qty"),
    priceOverride: numeric("price_override", { precision: 12, scale: 2, mode: "number" }),
    categoryId: integer("category_id"),
    sourceCatId: text("source_cat_id"),
    inStock: boolean("in_stock").notNull().default(true),
    isNew: boolean("is_new").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    salesCount: integer("sales_count").notNull().default(0),
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
