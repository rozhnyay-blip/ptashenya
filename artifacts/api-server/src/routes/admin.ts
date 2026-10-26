import { Router, type IRouter } from "express";
import {
  db,
  productsTable,
  categoriesTable,
  ordersTable,
  orderItemsTable,
  orderEventsTable,
  syncRunsTable,
  syncSourcesTable,
  settingsTable,
} from "@workspace/db";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  GetAdminSalesChartQueryParams,
  ListAdminOrdersQueryParams,
  GetAdminOrderParams,
  UpdateAdminOrderParams,
  UpdateAdminOrderBody,
  ListAdminProductsQueryParams,
  UpdateAdminProductParams,
  UpdateAdminProductBody,
  UpdateAdminSettingsBody,
  UpdateSyncSourcesBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth";
import { getSettings, retailPriceSql } from "../lib/settings";
import { adminProductFilter, sellableSql } from "../lib/admin-filters";
import { hasSupplierCredentials } from "../lib/supplier";
import { toAdminProduct, toOrder, toOrderDetail, toSyncRun } from "../lib/serialize";
import {
  getCurrentRun,
  getLastFinishedRun,
  isSyncRunning,
  lastRunKyivDay,
  nextScheduledAt,
  refreshSources,
  startSync,
} from "../lib/sync";

const router: IRouter = Router();
router.use("/admin", requireAdmin);

const STATUSES = ["new", "confirmed", "shipped", "delivered", "cancelled"] as const;
const STATUS_LABELS: Record<string, string> = {
  new: "Нове",
  confirmed: "Підтверджене",
  shipped: "Відправлене",
  delivered: "Доставлене",
  cancelled: "Скасоване",
};

async function statusCounts() {
  const rows = await db
    .select({ status: ordersTable.status, n: sql<number>`count(*)::int` })
    .from(ordersTable)
    .groupBy(ordersTable.status);
  const out = { new: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0 };
  for (const r of rows) if (r.status in out) out[r.status as keyof typeof out] = r.n;
  return out;
}

const notCancelled = sql`orders.status <> 'cancelled'`;

router.get("/admin/dashboard", async (_req, res) => {
  const [money] = (
    await db.execute<{
      revenue_total: string;
      revenue_30: string;
      revenue_prev_30: string;
      profit_30: string;
      orders_total: number;
      orders_30: number;
      orders_today: number;
      revenue_today: string;
      customers: number;
    }>(sql`
    select
      coalesce(sum(total) filter (where ${notCancelled}), 0) as revenue_total,
      coalesce(sum(total) filter (where ${notCancelled} and created_at >= now() - interval '30 days'), 0) as revenue_30,
      coalesce(sum(total) filter (where ${notCancelled} and created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'), 0) as revenue_prev_30,
      coalesce(sum(total - coalesce(cost, 0)) filter (where ${notCancelled} and created_at >= now() - interval '30 days'), 0) as profit_30,
      count(*)::int as orders_total,
      (count(*) filter (where created_at >= now() - interval '30 days'))::int as orders_30,
      (count(*) filter (where (created_at at time zone 'Europe/Kyiv')::date = (now() at time zone 'Europe/Kyiv')::date))::int as orders_today,
      coalesce(sum(total) filter (where ${notCancelled} and (created_at at time zone 'Europe/Kyiv')::date = (now() at time zone 'Europe/Kyiv')::date), 0) as revenue_today,
      (count(distinct right(regexp_replace(phone, '\\D', '', 'g'), 9)))::int as customers
    from orders`)
  ).rows;

  const [prod] = (
    await db.execute<{
      total: number;
      in_stock: number;
      out_of_stock: number;
      hidden: number;
      new_today: number;
      no_price: number;
    }>(sql`
    select count(*)::int as total,
      (count(*) filter (where ${sellableSql}))::int as in_stock,
      (count(*) filter (where not in_stock))::int as out_of_stock,
      (count(*) filter (where not is_active))::int as hidden,
      (count(*) filter (where in_stock and coalesce(price_override, supplier_price, 0) <= 0))::int as no_price,
      (count(*) filter (where first_seen_at >= date_trunc('day', now() at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv'))::int as new_today
    from products`)
  ).rows;

  const nonCancelledCount = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(notCancelled);
  const revenueTotal = Number(money?.revenue_total ?? 0);
  const lastRun = await getLastFinishedRun();

  res.json({
    revenueTotal,
    revenue30d: Number(money?.revenue_30 ?? 0),
    revenuePrev30d: Number(money?.revenue_prev_30 ?? 0),
    profit30d: Number(money?.profit_30 ?? 0),
    ordersTotal: money?.orders_total ?? 0,
    orders30d: money?.orders_30 ?? 0,
    ordersToday: money?.orders_today ?? 0,
    revenueToday: Number(money?.revenue_today ?? 0),
    avgOrderValue:
      nonCancelledCount[0]!.n > 0 ? Math.round((revenueTotal / nonCancelledCount[0]!.n) * 100) / 100 : 0,
    statusCounts: await statusCounts(),
    productsTotal: prod?.total ?? 0,
    productsInStock: prod?.in_stock ?? 0,
    productsOutOfStock: prod?.out_of_stock ?? 0,
    productsHidden: prod?.hidden ?? 0,
    productsNewToday: prod?.new_today ?? 0,
    customersTotal: money?.customers ?? 0,
    productsNoPrice: prod?.no_price ?? 0,
    lastSync: lastRun ? toSyncRun(lastRun) : null,
  });
});

router.get("/admin/sales-chart", async (req, res) => {
  const parsed = GetAdminSalesChartQueryParams.safeParse(req.query);
  const days = parsed.success ? (parsed.data.days ?? 30) : 30;
  const rows = await db.execute<{ day: string; revenue: string; orders: number }>(sql`
    with d as (
      select generate_series(
        (now() at time zone 'Europe/Kyiv')::date - (${days - 1})::int,
        (now() at time zone 'Europe/Kyiv')::date,
        interval '1 day')::date as day
    )
    select to_char(d.day, 'YYYY-MM-DD') as day,
      coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0) as revenue,
      count(o.id)::int as orders
    from d left join orders o on (o.created_at at time zone 'Europe/Kyiv')::date = d.day
    group by d.day order by d.day`);
  res.json(rows.rows.map((r) => ({ date: r.day, revenue: Number(r.revenue), orders: r.orders })));
});

router.get("/admin/top-products", async (_req, res) => {
  const rows = await db.execute<{
    product_id: number | null;
    name: string;
    image_url: string | null;
    quantity: number;
    revenue: string;
  }>(sql`
    select oi.product_id, max(oi.name) as name, max(oi.image_url) as image_url,
      sum(oi.quantity)::int as quantity, sum(oi.price * oi.quantity) as revenue
    from order_items oi join orders o on o.id = oi.order_id
    where o.status <> 'cancelled'
    group by oi.product_id order by revenue desc limit 10`);
  res.json(
    rows.rows.map((r) => ({
      productId: r.product_id,
      name: r.name,
      imageUrl: r.image_url,
      quantity: r.quantity,
      revenue: Number(r.revenue),
    })),
  );
});

router.get("/admin/category-breakdown", async (_req, res) => {
  const rows = await db.execute<{
    id: number;
    name: string;
    product_count: number;
    in_stock: number;
    revenue: string;
  }>(sql`
    with cat as (
      select c.id, coalesce(c.parent_id, c.id) as top_id from categories c
    ),
    prod as (
      select cat.top_id, count(p.id)::int as product_count,
        (count(p.id) filter (where p.in_stock and p.is_active))::int as in_stock
      from products p join cat on cat.id = p.category_id group by cat.top_id
    ),
    rev as (
      select cat.top_id, sum(oi.price * oi.quantity) as revenue
      from order_items oi
      join orders o on o.id = oi.order_id and o.status <> 'cancelled'
      join products p on p.id = oi.product_id
      join cat on cat.id = p.category_id
      group by cat.top_id
    )
    select c.id, c.name, coalesce(prod.product_count, 0) as product_count,
      coalesce(prod.in_stock, 0) as in_stock, coalesce(rev.revenue, 0) as revenue
    from categories c
    left join prod on prod.top_id = c.id
    left join rev on rev.top_id = c.id
    where c.parent_id is null
    order by revenue desc, product_count desc`);
  res.json(
    rows.rows.map((r) => ({
      categoryId: r.id,
      name: r.name,
      productCount: r.product_count,
      inStockCount: r.in_stock,
      revenue: Number(r.revenue),
    })),
  );
});

router.get("/admin/activity", async (_req, res) => {
  const events = await db
    .select({
      id: orderEventsTable.id,
      type: orderEventsTable.type,
      status: orderEventsTable.status,
      createdAt: orderEventsTable.createdAt,
      orderId: ordersTable.id,
      number: ordersTable.number,
      customerName: ordersTable.customerName,
      total: ordersTable.total,
    })
    .from(orderEventsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderEventsTable.orderId))
    .orderBy(desc(orderEventsTable.createdAt))
    .limit(20);
  const runs = await db
    .select()
    .from(syncRunsTable)
    .where(sql`${syncRunsTable.status} <> 'running'`)
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(10);

  const items = [
    ...events.map((e) => ({
      id: `e${e.id}`,
      type: e.type === "order_created" ? "order_created" : "order_status",
      title:
        e.type === "order_created"
          ? `Нове замовлення №${e.number} на ${Math.round(e.total)} грн`
          : `Замовлення №${e.number}: ${STATUS_LABELS[e.status ?? ""] ?? e.status}`,
      subtitle: e.customerName,
      orderId: e.orderId,
      createdAt: e.createdAt.toISOString(),
    })),
    ...runs.map((r) => ({
      id: `s${r.id}`,
      type: r.status === "success" ? "sync_finished" : "sync_failed",
      title:
        r.status === "success"
          ? `Синхронізація: +${r.added} нових, ${r.wentOutOfStock} закінчились`
          : "Синхронізація не вдалася",
      subtitle: r.status === "success" ? `Перевірено ${r.productsSeen} товарів` : r.errorMessage,
      orderId: null,
      createdAt: (r.finishedAt ?? r.startedAt).toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25);
  res.json(items);
});

router.get("/admin/orders", async (req, res) => {
  const parsed = ListAdminOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні параметри" });
    return;
  }
  const q = parsed.data;
  const page = q.page ?? 1;
  const limit = q.limit ?? 25;
  const conds: SQL[] = [];
  if (q.status) conds.push(eq(ordersTable.status, q.status));
  if (q.search && q.search.trim()) {
    const term = `%${q.search.trim()}%`;
    conds.push(
      or(
        ilike(ordersTable.number, term),
        ilike(ordersTable.customerName, term),
        ilike(ordersTable.phone, term),
        ilike(ordersTable.city, term),
      )!,
    );
  }
  const where = conds.length ? and(...conds) : undefined;
  const [rows, totalRows, counts] = await Promise.all([
    db
      .select()
      .from(ordersTable)
      .where(where)
      .orderBy(desc(ordersTable.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: sql<number>`count(*)::int` }).from(ordersTable).where(where),
    statusCounts(),
  ]);
  const total = totalRows[0]?.total ?? 0;
  res.json({
    items: rows.map((o) => toOrder(o, true)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    statusCounts: counts,
  });
});

async function orderDetail(id: number) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) return null;
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, id))
    .orderBy(asc(orderItemsTable.id));
  return toOrderDetail(order, items, true);
}

router.get("/admin/orders/:id", async (req, res) => {
  const params = GetAdminOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Невірний id" });
    return;
  }
  const detail = await orderDetail(params.data.id);
  if (!detail) {
    res.status(404).json({ error: "Замовлення не знайдено" });
    return;
  }
  res.json(detail);
});

router.patch("/admin/orders/:id", async (req, res) => {
  const params = UpdateAdminOrderParams.safeParse(req.params);
  const body = UpdateAdminOrderBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Невірні дані" });
    return;
  }
  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Замовлення не знайдено" });
    return;
  }
  const patch: Partial<typeof ordersTable.$inferInsert> = {};
  if (body.data.status && STATUSES.includes(body.data.status)) patch.status = body.data.status;
  if (body.data.adminNote !== undefined) patch.adminNote = body.data.adminNote;
  if (Object.keys(patch).length > 0) {
    await db.update(ordersTable).set(patch).where(eq(ordersTable.id, existing.id));
  }
  if (patch.status && patch.status !== existing.status) {
    await db
      .insert(orderEventsTable)
      .values({ orderId: existing.id, type: "order_status", status: patch.status });
    // Sales counters only count orders that are not cancelled.
    const delta =
      patch.status === "cancelled" ? -1 : existing.status === "cancelled" ? 1 : 0;
    if (delta !== 0) {
      await db.execute(sql`
        update products set sales_count = greatest(0, products.sales_count + ${delta} * oi.qty)
        from (select product_id, sum(quantity)::int as qty from order_items
              where order_id = ${existing.id} and product_id is not null group by product_id) oi
        where products.id = oi.product_id`);
    }
  }
  res.json(await orderDetail(existing.id));
});

router.get("/admin/products", async (req, res) => {
  const parsed = ListAdminProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні параметри" });
    return;
  }
  const q = parsed.data;
  const page = q.page ?? 1;
  const limit = q.limit ?? 25;
  const where = await adminProductFilter(q);
  const settingsForSort = await getSettings();
  const price = retailPriceSql(settingsForSort);
  const profitExpr = sql`(${price} - coalesce(products.supplier_price, ${price}))`;
  const qtyExpr = sql`(case when products.in_stock then coalesce(products.stock_qty, 0) else 0 end)`;
  const orderBy: SQL[] = (() => {
    switch (q.sort) {
      case "profit_desc":
        return [sql`${profitExpr} desc`];
      case "stock_value_desc":
        return [sql`${profitExpr} * ${qtyExpr} desc nulls last`];
      case "price_asc":
        return [sql`${price} asc`];
      case "price_desc":
        return [sql`${price} desc`];
      case "stock_desc":
        return [sql`${qtyExpr} desc`];
      case "sales_desc":
        return [desc(productsTable.salesCount)];
      default:
        return [desc(productsTable.firstSeenAt)];
    }
  })();

  const [rows, totalRows, settings, cats] = await Promise.all([
    db
      .select()
      .from(productsTable)
      .where(where)
      .orderBy(...orderBy, desc(productsTable.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: sql<number>`count(*)::int` }).from(productsTable).where(where),
    getSettings(),
    db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable),
  ]);
  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  const total = totalRows[0]?.total ?? 0;
  res.json({
    items: rows.map((p) => toAdminProduct(p, settings, p.categoryId ? (catMap.get(p.categoryId) ?? null) : null)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

router.patch("/admin/products/:id", async (req, res) => {
  const params = UpdateAdminProductParams.safeParse(req.params);
  const body = UpdateAdminProductBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Невірні дані" });
    return;
  }
  const patch: Partial<typeof productsTable.$inferInsert> = {};
  if (body.data.isActive !== undefined) patch.isActive = body.data.isActive;
  if (body.data.isFeatured !== undefined) patch.isFeatured = body.data.isFeatured;
  if (body.data.priceOverride !== undefined) {
    if (body.data.priceOverride !== null && body.data.priceOverride <= 0) {
      res.status(400).json({ error: "Ціна має бути більшою за 0" });
      return;
    }
    patch.priceOverride = body.data.priceOverride;
  }
  const [row] = Object.keys(patch).length
    ? await db.update(productsTable).set(patch).where(eq(productsTable.id, params.data.id)).returning()
    : await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Товар не знайдено" });
    return;
  }
  const settings = await getSettings();
  const [cat] = row.categoryId
    ? await db.select().from(categoriesTable).where(eq(categoriesTable.id, row.categoryId))
    : [];
  res.json(toAdminProduct(row, settings, cat?.name ?? null));
});

function settingsOut(s: Awaited<ReturnType<typeof getSettings>>) {
  return {
    storeName: s.storeName,
    markupPercent: Number(s.markupPercent),
    roundPrices: s.roundPrices,
    autoSyncEnabled: s.autoSyncEnabled,
    autoSyncHour: s.autoSyncHour,
    contactPhone: s.contactPhone,
    minOrderAmount: Number(s.minOrderAmount),
    freeShippingFrom: s.freeShippingFrom === null ? null : Number(s.freeShippingFrom),
  };
}

router.get("/admin/settings", async (_req, res) => {
  res.json(settingsOut(await getSettings()));
});

router.put("/admin/settings", async (req, res) => {
  const body = UpdateAdminSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Невірні налаштування" });
    return;
  }
  await getSettings();
  const d = body.data;
  const patch: Partial<typeof settingsTable.$inferInsert> = {};
  if (d.storeName !== undefined) patch.storeName = d.storeName.trim();
  if (d.markupPercent !== undefined) patch.markupPercent = d.markupPercent;
  if (d.roundPrices !== undefined) patch.roundPrices = d.roundPrices;
  if (d.autoSyncEnabled !== undefined) patch.autoSyncEnabled = d.autoSyncEnabled;
  if (d.autoSyncHour !== undefined) patch.autoSyncHour = d.autoSyncHour;
  if (d.contactPhone !== undefined) patch.contactPhone = d.contactPhone.trim();
  if (d.minOrderAmount !== undefined) patch.minOrderAmount = d.minOrderAmount;
  if (d.freeShippingFrom !== undefined) patch.freeShippingFrom = d.freeShippingFrom;
  if (Object.keys(patch).length) await db.update(settingsTable).set(patch).where(eq(settingsTable.id, 1));
  res.json(settingsOut(await getSettings()));
});

router.get("/admin/sync/status", async (_req, res) => {
  const [settings, current, lastRun, lastDay] = await Promise.all([
    getSettings(),
    getCurrentRun(),
    getLastFinishedRun(),
    lastRunKyivDay(),
  ]);
  res.json({
    running: isSyncRunning(),
    current: current ? toSyncRun(current) : null,
    lastRun: lastRun ? toSyncRun(lastRun) : null,
    autoSyncEnabled: settings.autoSyncEnabled,
    autoSyncHour: settings.autoSyncHour,
    nextScheduledAt:
      nextScheduledAt(settings.autoSyncEnabled, settings.autoSyncHour, lastDay)?.toISOString() ?? null,
    supplierAccountConnected: hasSupplierCredentials(),
  });
});

router.post("/admin/sync/run", async (req, res) => {
  const run = await startSync("manual");
  if (!run) {
    res.status(409).json({ error: "Синхронізація вже виконується" });
    return;
  }
  req.log.info({ runId: run.id }, "Manual sync started");
  res.status(202).json(toSyncRun(run));
});

router.get("/admin/sync/runs", async (_req, res) => {
  const rows = await db.select().from(syncRunsTable).orderBy(desc(syncRunsTable.startedAt)).limit(30);
  res.json(rows.map(toSyncRun));
});

async function sourcesOut() {
  const [sources, counts] = await Promise.all([
    db.select().from(syncSourcesTable).orderBy(asc(syncSourcesTable.sortOrder)),
    db
      .select({ src: productsTable.sourceCatId, n: sql<number>`count(*)::int` })
      .from(productsTable)
      .groupBy(productsTable.sourceCatId),
  ]);
  const countMap = new Map(counts.map((c) => [c.src, c.n]));
  return sources.map((s) => ({
    supplierCatId: s.supplierCatId,
    name: s.name,
    url: s.url,
    enabled: s.enabled,
    subcategoryCount: s.subcategoryCount,
    productCount: countMap.get(s.supplierCatId) ?? 0,
  }));
}

router.get("/admin/sync/sources", async (req, res) => {
  const existing = await db.select({ id: syncSourcesTable.supplierCatId }).from(syncSourcesTable).limit(1);
  if (existing.length === 0) {
    try {
      await refreshSources();
    } catch (err) {
      req.log.warn({ err }, "Could not refresh supplier sources");
    }
  }
  res.json(await sourcesOut());
});

router.put("/admin/sync/sources", async (req, res) => {
  const body = UpdateSyncSourcesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Невірні дані" });
    return;
  }
  const ids = body.data.enabledIds;
  await db.update(syncSourcesTable).set({ enabled: false });
  if (ids.length > 0) {
    await db
      .update(syncSourcesTable)
      .set({ enabled: true })
      .where(inArray(syncSourcesTable.supplierCatId, ids));
  }
  res.json(await sourcesOut());
});

export default router;
