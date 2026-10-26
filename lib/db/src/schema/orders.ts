import { pgTable, serial, text, integer, timestamp, numeric, index } from "drizzle-orm/pg-core";

export const ordersTable = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    number: text("number").notNull().unique(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    city: text("city").notNull(),
    deliveryMethod: text("delivery_method").notNull(),
    deliveryAddress: text("delivery_address"),
    paymentMethod: text("payment_method").notNull(),
    comment: text("comment"),
    adminNote: text("admin_note"),
    status: text("status").notNull().default("new"),
    total: numeric("total", { precision: 12, scale: 2, mode: "number" }).notNull(),
    cost: numeric("cost", { precision: 12, scale: 2, mode: "number" }),
    itemsCount: integer("items_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("orders_created_idx").on(t.createdAt), index("orders_status_idx").on(t.status)],
);

export const orderItemsTable = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    productId: integer("product_id"),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    imageUrl: text("image_url"),
    price: numeric("price", { precision: 12, scale: 2, mode: "number" }).notNull(),
    supplierPrice: numeric("supplier_price", { precision: 12, scale: 2, mode: "number" }),
    quantity: integer("quantity").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEventsTable = pgTable("order_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrderRow = typeof ordersTable.$inferSelect;
export type OrderItemRow = typeof orderItemsTable.$inferSelect;
