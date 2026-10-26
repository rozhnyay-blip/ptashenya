import { pgTable, serial, text, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";

export const syncRunsTable = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("running"),
  trigger: text("trigger").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  pagesScanned: integer("pages_scanned").notNull().default(0),
  pagesTotal: integer("pages_total"),
  productsSeen: integer("products_seen").notNull().default(0),
  added: integer("added").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  wentOutOfStock: integer("went_out_of_stock").notNull().default(0),
  backInStock: integer("back_in_stock").notNull().default(0),
  currentStep: text("current_step"),
  errorMessage: text("error_message"),
});

export const syncSourcesTable = pgTable("sync_sources", {
  supplierCatId: text("supplier_cat_id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  subcategoryCount: integer("subcategory_count").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  storeName: text("store_name").notNull().default("Пташеня"),
  markupPercent: numeric("markup_percent", { precision: 6, scale: 2, mode: "number" })
    .notNull()
    .default(35),
  roundPrices: boolean("round_prices").notNull().default(true),
  autoSyncEnabled: boolean("auto_sync_enabled").notNull().default(true),
  autoSyncHour: integer("auto_sync_hour").notNull().default(6),
  contactPhone: text("contact_phone").notNull().default(""),
  minOrderAmount: numeric("min_order_amount", { precision: 12, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  freeShippingFrom: numeric("free_shipping_from", { precision: 12, scale: 2, mode: "number" }),
});

export type SyncRunRow = typeof syncRunsTable.$inferSelect;
export type SettingsRow = typeof settingsTable.$inferSelect;
