import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const categoriesTable = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    supplierCatId: text("supplier_cat_id").notNull().unique(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    url: text("url").notNull(),
    parentId: integer("parent_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("categories_parent_idx").on(t.parentId)],
);

export type CategoryRow = typeof categoriesTable.$inferSelect;
