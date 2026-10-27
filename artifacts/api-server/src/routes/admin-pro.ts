import { Router, type IRouter, type Response } from "express";
import {
  db,
  productsTable,
  categoriesTable,
  priceChangesTable,
  settingsTable,
  ordersTable,
  orderItemsTable,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, lt, gt, sql, type SQL } from "drizzle-orm";
import {
  GetAdminProductsSummaryQueryParams,
  BulkUpdateAdminProductsBody,
  ListAdminPriceChangesQueryParams,
  UpdateAdminSeoBody,
  ListAdminProductsQueryParams,
  ListAdminOrdersQueryParams,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth";
import { getSettings, retailPrice, retailPriceSql } from "../lib/settings";
import { adminProductFilter, allUnitsSql, approxUnitsSql, moneyBaseSql, onOrderSql, oneUnitSql, readySql, sellableSql, unitSqls } from "../lib/admin-filters";
import { toAdminProduct } from "../lib/serialize";
import { SEO_PLACEHOLDERS, isSeoRunning, runSeo } from "../lib/seo";

const router: IRouter = Router();
router.use("/admin", requireAdmin);

const round2 = (n: number) => Math.round(n * 100) / 100;
const margin = (retail: number, cost: number) => (retail > 0 ? round2(((retail - cost) / retail) * 100) : 0);

function allUnitsMoney(r: { units?: number | null; approx?: number | null; cost?: number | null; retail?: number | null } | undefined) {
  const cost = round2(Number(r?.cost ?? 0));
  const retail = round2(Number(r?.retail ?? 0));
  return {
    units: Number(r?.units ?? 0),
    approxPositions: Number(r?.approx ?? 0),
    costValue: cost,
    retailValue: retail,
    profit: round2(retail - cost),
    marginPercent: margin(retail, cost),
  };
}

/** Stock money as of the latest sync over `base` (default: ready-to-ship products a customer can buy today). */
async function moneyTotals(where: SQL | undefined, base: SQL = readySql) {
  const s = await getSettings();
  const price = retailPriceSql(s);
  const u = unitSqls(base);
  const [row] = await db
    .select({
      positions: sql<number>`count(*)::int`,
      positionsWithStock: sql<number>`coalesce(sum(${u.one}), 0)::int`,
      cost: sql<number>`coalesce(sum(${u.one} * coalesce(products.supplier_price, 0)), 0)::float8`,
      retail: sql<number>`coalesce(sum(${u.one} * ${price}), 0)::float8`,
      units: sql<number>`coalesce(sum(${u.all}), 0)::int`,
      approx: sql<number>`coalesce(sum(${u.approx}), 0)::int`,
      allCost: sql<number>`coalesce(sum(${u.all} * coalesce(products.supplier_price, 0)), 0)::float8`,
      allRetail: sql<number>`coalesce(sum(${u.all} * ${price}), 0)::float8`,
    })
    .from(productsTable)
    .where(where);
  const cost = round2(row?.cost ?? 0);
  const retail = round2(row?.retail ?? 0);
  const profit = round2(retail - cost);
  return {
    positions: row?.positions ?? 0,
    positionsWithStock: row?.positionsWithStock ?? 0,
    costValue: cost,
    retailValue: retail,
    profit,
    marginPercent: retail > 0 ? round2((profit / retail) * 100) : 0,
    markupPercent: Number(s.markupPercent),
    allUnits: allUnitsMoney({ units: row?.units, approx: row?.approx, cost: row?.allCost, retail: row?.allRetail }),
  };
}

router.get("/admin/products/summary", async (req, res) => {
  const parsed = GetAdminProductsSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні параметри" });
    return;
  }
  const where = await adminProductFilter(parsed.data);
  const base = moneyBaseSql(parsed.data.stock);
  const totals = await moneyTotals(where, base);
  let whatIf = null;
  if (parsed.data.whatIfMarkup !== undefined) {
    const s = await getSettings();
    const price = retailPriceSql({ markupPercent: parsed.data.whatIfMarkup, roundPrices: s.roundPrices });
    const u = unitSqls(base);
    const [row] = await db
      .select({
        retail: sql<number>`coalesce(sum(${u.one} * ${price}), 0)::float8`,
        allRetail: sql<number>`coalesce(sum(${u.all} * ${price}), 0)::float8`,
      })
      .from(productsTable)
      .where(where);
    const retail = round2(row?.retail ?? 0);
    whatIf = {
      markupPercent: parsed.data.whatIfMarkup,
      retailValue: retail,
      profit: round2(retail - totals.costValue),
      allUnitsRetailValue: round2(row?.allRetail ?? 0),
      allUnitsProfit: round2((row?.allRetail ?? 0) - totals.allUnits.costValue),
    };
  }
  res.json({ ...totals, whatIf });
});

router.post("/admin/products/bulk", async (req, res) => {
  const parsed = BulkUpdateAdminProductsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні дані" });
    return;
  }
  const { ids, action, price } = parsed.data;
  let patch: Partial<typeof productsTable.$inferInsert>;
  switch (action) {
    case "hide":
      patch = { isActive: false };
      break;
    case "show":
      patch = { isActive: true };
      break;
    case "feature":
      patch = { isFeatured: true };
      break;
    case "unfeature":
      patch = { isFeatured: false };
      break;
    case "reset_price":
      patch = { priceOverride: null };
      break;
    case "set_price":
      if (price === undefined || !(price > 0)) {
        res.status(400).json({ error: "Вкажіть ціну більшу за 0" });
        return;
      }
      patch = { priceOverride: round2(price) };
      break;
  }
  const rows = await db
    .update(productsTable)
    .set(patch)
    .where(inArray(productsTable.id, ids))
    .returning({ id: productsTable.id });
  res.json({ updated: rows.length });
});

const STOCK_BUCKETS = [
  { label: "1–9 шт", minQty: 1, maxQty: 9 },
  { label: "10–99 шт", minQty: 10, maxQty: 99 },
  { label: "100–999 шт", minQty: 100, maxQty: 999 },
  { label: "1000+ шт", minQty: 1000, maxQty: null },
] as const;

/** Stock split by delivery speed: ready to ship (≤3 days), on order (partner warehouse), and both together. */
router.get("/admin/stock-overview", async (_req, res) => {
  const s = await getSettings();
  const price = retailPriceSql(s);
  const zoneFields = (prefix: string, base: SQL) => {
    const u = unitSqls(base);
    return {
      [`${prefix}Positions`]: sql<number>`coalesce(sum(${u.one}), 0)::int`,
      [`${prefix}Units`]: sql<number>`coalesce(sum(${u.all}), 0)::int`,
      [`${prefix}Approx`]: sql<number>`coalesce(sum(${u.approx}), 0)::int`,
      [`${prefix}Biggest`]: sql<number>`coalesce(max(case when ${base} then products.stock_qty end), 0)::int`,
      [`${prefix}Cost1`]: sql<number>`coalesce(sum(${u.one} * coalesce(products.supplier_price, 0)), 0)::float8`,
      [`${prefix}Retail1`]: sql<number>`coalesce(sum(${u.one} * ${price}), 0)::float8`,
      [`${prefix}CostAll`]: sql<number>`coalesce(sum(${u.all} * coalesce(products.supplier_price, 0)), 0)::float8`,
      [`${prefix}RetailAll`]: sql<number>`coalesce(sum(${u.all} * ${price}), 0)::float8`,
    };
  };
  const qty = sql`coalesce(products.stock_qty, 1)`;
  const bucketIdx = sql`(case when ${qty} >= 1000 then 3 when ${qty} >= 100 then 2 when ${qty} >= 10 then 1 else 0 end)`;
  const [[z], bucketRows, top] = await Promise.all([
    db
      .select({ ...zoneFields("r", readySql), ...zoneFields("o", onOrderSql), ...zoneFields("t", sellableSql) })
      .from(productsTable),
    db
      .select({
        idx: sql<number>`${bucketIdx}::int`,
        positions: sql<number>`count(*)::int`,
        ready: sql<number>`(count(*) filter (where ${readySql}))::int`,
        units: sql<number>`sum(${qty})::int`,
        cost: sql<number>`sum(${qty} * coalesce(products.supplier_price, 0))::float8`,
        retail: sql<number>`sum(${qty} * ${price})::float8`,
      })
      .from(productsTable)
      .where(sql`${sellableSql} and ${qty} > 0`)
      .groupBy(sql`1`),
    db
      .select({
        p: productsTable,
        retailOne: sql<number>`${price}::float8`,
      })
      .from(productsTable)
      .where(sql`${sellableSql} and products.stock_qty > 0`)
      .orderBy(sql`products.stock_qty * coalesce(products.supplier_price, 0) desc`)
      .limit(10),
  ]);
  const row = z as Record<string, number>;
  const money = (cost: number, retail: number) => ({
    costValue: round2(cost),
    retailValue: round2(retail),
    profit: round2(retail - cost),
    marginPercent: margin(retail, cost),
  });
  const zone = (p: string) => ({
    positions: Number(row[`${p}Positions`] ?? 0),
    units: Number(row[`${p}Units`] ?? 0),
    approxPositions: Number(row[`${p}Approx`] ?? 0),
    biggestStock: Number(row[`${p}Biggest`] ?? 0),
    oneUnit: money(Number(row[`${p}Cost1`] ?? 0), Number(row[`${p}Retail1`] ?? 0)),
    allUnits: money(Number(row[`${p}CostAll`] ?? 0), Number(row[`${p}RetailAll`] ?? 0)),
  });
  res.json({
    markupPercent: Number(s.markupPercent),
    ready: zone("r"),
    onOrder: zone("o"),
    total: zone("t"),
    buckets: STOCK_BUCKETS.map((b, i) => {
      const r = bucketRows.find((x) => Number(x.idx) === i);
      return {
        ...b,
        positions: r?.positions ?? 0,
        readyPositions: r?.ready ?? 0,
        units: r?.units ?? 0,
        costValue: round2(Number(r?.cost ?? 0)),
        retailValue: round2(Number(r?.retail ?? 0)),
      };
    }),
    topByValue: top.map(({ p, retailOne }) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      imageUrl: p.imageUrl,
      stockQty: p.stockQty,
      stockQtyMax: p.stockQtyMax,
      deliveryDays: p.deliveryDays,
      price: round2(retailOne),
      costValue: round2((p.stockQty ?? 0) * (p.supplierPrice ?? 0)),
      retailValue: round2((p.stockQty ?? 0) * retailOne),
    })),
  });
});

router.get("/admin/inventory", async (_req, res) => {
  const s = await getSettings();
  const price = retailPriceSql(s);
  const [totals, byCat, lowStock, cats] = await Promise.all([
    moneyTotals(undefined),
    db.execute<{
      category_id: number;
      positions: number;
      cost: number;
      retail: number;
      units: number;
      approx: number;
      all_cost: number;
      all_retail: number;
    }>(sql`
      select coalesce(c.parent_id, c.id) as category_id,
        (count(*) filter (where ${oneUnitSql} > 0))::int as positions,
        coalesce(sum(${oneUnitSql} * coalesce(products.supplier_price, 0)), 0)::float8 as cost,
        coalesce(sum(${oneUnitSql} * ${price}), 0)::float8 as retail,
        coalesce(sum(${allUnitsSql}), 0)::int as units,
        coalesce(sum(${approxUnitsSql}), 0)::int as approx,
        coalesce(sum(${allUnitsSql} * coalesce(products.supplier_price, 0)), 0)::float8 as all_cost,
        coalesce(sum(${allUnitsSql} * ${price}), 0)::float8 as all_retail
      from products join categories c on c.id = products.category_id
      group by 1 order by retail desc`),
    db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.isActive, true),
          gt(productsTable.salesCount, 0),
          sql`(not ${productsTable.inStock} or coalesce(${productsTable.stockQty}, 0) <= 3)`,
        ),
      )
      .orderBy(desc(productsTable.salesCount))
      .limit(10),
    db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable),
  ]);
  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  res.json({
    positionsInStock: totals.positionsWithStock,
    costValue: totals.costValue,
    retailValue: totals.retailValue,
    profit: totals.profit,
    marginPercent: totals.marginPercent,
    markupPercent: totals.markupPercent,
    allUnits: totals.allUnits,
    categories: byCat.rows
      .filter((r) => r.positions > 0)
      .map((r) => ({
        categoryId: r.category_id,
        name: catMap.get(r.category_id) ?? "Без категорії",
        positions: r.positions,
        costValue: round2(r.cost),
        retailValue: round2(r.retail),
        profit: round2(r.retail - r.cost),
        allUnits: allUnitsMoney({ units: r.units, approx: r.approx, cost: r.all_cost, retail: r.all_retail }),
      })),
    lowStockBestsellers: lowStock.map((p) =>
      toAdminProduct(p, s, p.categoryId ? (catMap.get(p.categoryId) ?? null) : null),
    ),
  });
});

router.get("/admin/price-changes", async (req, res) => {
  const parsed = ListAdminPriceChangesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні параметри" });
    return;
  }
  const direction = parsed.data.direction ?? "all";
  const limit = parsed.data.limit ?? 50;
  const s = await getSettings();
  const conds = [];
  if (direction === "up") conds.push(gt(priceChangesTable.newPrice, priceChangesTable.oldPrice));
  if (direction === "down") conds.push(lt(priceChangesTable.newPrice, priceChangesTable.oldPrice));
  const since = new Date(Date.now() - 30 * 24 * 3600_000);
  const [rows, [counts]] = await Promise.all([
    db
      .select({ change: priceChangesTable, product: productsTable })
      .from(priceChangesTable)
      .innerJoin(productsTable, eq(productsTable.id, priceChangesTable.productId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(priceChangesTable.changedAt), desc(priceChangesTable.id))
      .limit(limit),
    db
      .select({
        up: sql<number>`(count(*) filter (where new_price > old_price))::int`,
        down: sql<number>`(count(*) filter (where new_price < old_price))::int`,
      })
      .from(priceChangesTable)
      .where(gte(priceChangesTable.changedAt, since)),
  ]);
  res.json({
    items: rows.map(({ change, product }) => ({
      id: change.id,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      imageUrl: product.imageUrl,
      oldPrice: change.oldPrice,
      newPrice: change.newPrice,
      changePercent: change.oldPrice > 0 ? round2(((change.newPrice - change.oldPrice) / change.oldPrice) * 100) : 0,
      retailPrice: retailPrice(product.supplierPrice, product.priceOverride, s),
      inStock: product.inStock && product.isActive,
      changedAt: change.changedAt.toISOString(),
    })),
    up30d: counts?.up ?? 0,
    down30d: counts?.down ?? 0,
  });
});

async function seoStatus() {
  const s = await getSettings();
  const price = retailPriceSql(s);
  const visible = sql`products.is_active and products.in_stock and coalesce(products.price_override, products.supplier_price, 0) > 0
    and products.source_cat_id in (select supplier_cat_id from sync_sources where enabled)`;
  const [counts] = await db
    .select({
      inStock: sql<number>`count(*)::int`,
      withSeo: sql<number>`(count(*) filter (where products.seo_title is not null))::int`,
    })
    .from(productsTable)
    .where(visible);
  const samples = await db.execute<{
    id: number;
    name: string;
    category: string | null;
    price: number;
    sku: string;
    article: string | null;
    seo_title: string | null;
    seo_description: string | null;
  }>(sql`
    select products.id, products.name, c.name as category, (${price})::float8 as price, products.sku, products.article,
      products.seo_title, products.seo_description
    from products left join categories c on c.id = products.category_id
    where ${visible} and products.image_url is not null
    order by products.sales_count desc, products.first_seen_at desc
    limit 3`);
  return {
    titleTemplate: s.seoTitleTemplate,
    descriptionTemplate: s.seoDescriptionTemplate,
    autoAfterSync: s.seoAutoAfterSync,
    lastRunAt: s.seoLastRunAt ? s.seoLastRunAt.toISOString() : null,
    lastRunCount: s.seoLastRunCount,
    productsInStock: counts?.inStock ?? 0,
    productsWithSeo: counts?.withSeo ?? 0,
    storeName: s.storeName,
    samples: samples.rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category ?? "",
      price: Number(r.price),
      sku: r.sku,
      article: r.article,
      seoTitle: r.seo_title,
      seoDescription: r.seo_description,
    })),
    sitemapPath: "/api/sitemap.xml",
    placeholders: [...SEO_PLACEHOLDERS],
  };
}

router.get("/admin/seo", async (_req, res) => {
  res.json(await seoStatus());
});

router.put("/admin/seo", async (req, res) => {
  const parsed = UpdateAdminSeoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні дані" });
    return;
  }
  const b = parsed.data;
  const patch: Partial<typeof settingsTable.$inferInsert> = {};
  if (b.titleTemplate !== undefined) {
    if (!b.titleTemplate.includes("{name}")) {
      res.status(400).json({ error: "Шаблон заголовка має містити {name}" });
      return;
    }
    patch.seoTitleTemplate = b.titleTemplate.trim();
  }
  if (b.descriptionTemplate !== undefined) patch.seoDescriptionTemplate = b.descriptionTemplate.trim();
  if (b.autoAfterSync !== undefined) patch.seoAutoAfterSync = b.autoAfterSync;
  if (Object.keys(patch).length) {
    await getSettings();
    await db.update(settingsTable).set(patch).where(eq(settingsTable.id, 1));
  }
  res.json(await seoStatus());
});

router.post("/admin/seo/run", async (req, res) => {
  if (isSeoRunning()) {
    res.status(409).json({ error: "SEO вже оновлюється, зачекайте кілька секунд" });
    return;
  }
  try {
    const r = await runSeo();
    res.json({ updated: r.updated, durationMs: r.durationMs, lastRunAt: r.lastRunAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "SEO run failed");
    res.status(500).json({ error: "Не вдалося оновити SEO" });
  }
});

// ---------- CSV exports (opened in Excel; semicolon-separated with BOM for Ukrainian Excel) ----------

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sendCsv(res: Response, filename: string, header: string[], rows: unknown[][]) {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + body);
}

router.get("/admin/export/products.csv", async (req, res) => {
  const parsed = ListAdminProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні параметри" });
    return;
  }
  const s = await getSettings();
  const [rows, cats] = await Promise.all([
    db
      .select()
      .from(productsTable)
      .where(await adminProductFilter(parsed.data))
      .orderBy(desc(productsTable.firstSeenAt))
      .limit(100_000),
    db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable),
  ]);
  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  sendCsv(
    res,
    `tovary-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Код", "Артикул", "Назва", "Категорія", "Закупка", "Ціна продажу", "Прибуток з шт", "Залишок", "В наявності", "Доставка від постачальника", "Показується", "Продано", "Посилання постачальника"],
    rows.map((p) => {
      const a = toAdminProduct(p, s, p.categoryId ? (catMap.get(p.categoryId) ?? null) : null);
      return [
        p.sku,
        p.article,
        p.name,
        a.categoryName,
        p.supplierPrice,
        a.price || null,
        a.profitPerUnit,
        !p.inStock ? 0
          : p.stockQty === null ? null
          : p.stockQtyMax === p.stockQty ? p.stockQty
          : p.stockQtyMax === null ? `понад ${p.stockQty} (точно невідомо)`
          : `${p.stockQty}–${p.stockQtyMax} (точно невідомо)`,
        p.inStock ? "так" : "ні",
        !p.inStock ? null : p.deliveryDays != null && p.deliveryDays > 3 ? `під замовлення, до ${p.deliveryDays} днів` : "зі складу, до 3 днів",
        p.isActive ? "так" : "ні",
        p.salesCount,
        p.supplierUrl,
      ];
    }),
  );
});

const STATUS_UA: Record<string, string> = {
  new: "Нове",
  confirmed: "Підтверджене",
  shipped: "Відправлене",
  delivered: "Доставлене",
  cancelled: "Скасоване",
};

router.get("/admin/export/orders.csv", async (req, res) => {
  const parsed = ListAdminOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні параметри" });
    return;
  }
  const where = parsed.data.status ? eq(ordersTable.status, parsed.data.status) : undefined;
  const orders = await db.select().from(ordersTable).where(where).orderBy(desc(ordersTable.createdAt));
  const items = orders.length
    ? await db
        .select()
        .from(orderItemsTable)
        .where(inArray(orderItemsTable.orderId, orders.map((o) => o.id)))
    : [];
  const itemsByOrder = new Map<number, string[]>();
  for (const i of items) {
    const list = itemsByOrder.get(i.orderId) ?? [];
    list.push(`${i.name} ×${i.quantity}`);
    itemsByOrder.set(i.orderId, list);
  }
  sendCsv(
    res,
    `zamovlennya-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Номер", "Дата", "Статус", "Клієнт", "Телефон", "Email", "Місто", "Доставка", "Адреса", "Оплата", "Сума", "Собівартість", "Прибуток", "Товари", "Коментар"],
    orders.map((o) => [
      o.number,
      o.createdAt.toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" }),
      STATUS_UA[o.status] ?? o.status,
      o.customerName,
      o.phone,
      o.email,
      o.city,
      o.deliveryMethod,
      o.deliveryAddress,
      o.paymentMethod,
      o.total,
      o.cost,
      o.cost !== null ? round2(o.total - o.cost) : null,
      (itemsByOrder.get(o.id) ?? []).join(", "),
      o.comment,
    ]),
  );
});

export default router;
