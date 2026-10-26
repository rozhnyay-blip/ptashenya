import { Router, type IRouter } from "express";
import { db, productsTable, categoriesTable, ordersTable, type ProductRow } from "@workspace/db";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  ListProductsQueryParams,
  GetProductParams,
  GetRelatedProductsParams,
} from "@workspace/api-zod";
import { getSettings, retailPriceSql } from "../lib/settings";
import { toProduct } from "../lib/serialize";
import { fetchHtml, parseProductDetails } from "../lib/supplier";
import { getLastFinishedRun } from "../lib/sync";
import { buildSitemap } from "../lib/seo";

const router: IRouter = Router();

/** Products a customer may see: owner-visible, on the warehouse, from an enabled supplier source. */
export const visibleSql = sql`products.is_active = true and products.in_stock = true and coalesce(products.price_override, products.supplier_price, 0) > 0 and products.source_cat_id in (select supplier_cat_id from sync_sources where enabled = true)`;

async function categoryNames(): Promise<Map<number, { name: string; parentId: number | null }>> {
  const rows = await db
    .select({ id: categoriesTable.id, name: categoriesTable.name, parentId: categoriesTable.parentId })
    .from(categoriesTable);
  return new Map(rows.map((r) => [r.id, { name: r.name, parentId: r.parentId }]));
}

export async function serializeProducts(rows: ProductRow[]) {
  const [settings, cats] = await Promise.all([getSettings(), categoryNames()]);
  return rows.map((p) =>
    toProduct(p, settings, p.categoryId ? (cats.get(p.categoryId)?.name ?? null) : null),
  );
}

export async function listVisibleCategories() {
  const counts = await db.execute<{ category_id: number; cnt: string; img: string | null }>(sql`
    select category_id, count(*)::text as cnt,
      (array_agg(image_url order by sales_count desc, id desc) filter (where image_url is not null))[1] as img
    from products where ${visibleSql} and category_id is not null
    group by category_id`);
  const countMap = new Map(counts.rows.map((r) => [Number(r.category_id), r]));
  const cats = await db
    .select()
    .from(categoriesTable)
    .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));

  const result = cats.map((c) => {
    const own = countMap.get(c.id);
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      productCount: own ? Number(own.cnt) : 0,
      imageUrl: own?.img ?? null,
    };
  });
  const byId = new Map(result.map((c) => [c.id, c]));
  for (const c of result) {
    if (c.parentId === null) continue;
    const parent = byId.get(c.parentId);
    if (!parent) continue;
    parent.productCount += c.productCount;
    if (!parent.imageUrl && c.imageUrl) parent.imageUrl = c.imageUrl;
  }
  return result.filter((c) => c.productCount > 0);
}

let sitemapCache: { origin: string; xml: string; expires: number } | null = null;

router.get("/sitemap.xml", async (req, res) => {
  const host = (req.get("x-forwarded-host") ?? req.get("host") ?? "").split(",")[0]!.trim();
  const proto = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0]!.trim();
  const origin = `${proto}://${host}`;
  if (!sitemapCache || sitemapCache.origin !== origin || sitemapCache.expires < Date.now()) {
    sitemapCache = { origin, xml: await buildSitemap(origin), expires: Date.now() + 3600_000 };
  }
  res.type("application/xml").send(sitemapCache.xml);
});

router.get("/categories", async (_req, res) => {
  res.json(await listVisibleCategories());
});

async function categoryWithChildren(categoryId: number): Promise<number[]> {
  const children = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.parentId, categoryId));
  return [categoryId, ...children.map((c) => c.id)];
}

router.get("/products", async (req, res) => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Невірні параметри" });
    return;
  }
  const q = parsed.data;
  const onlyNew = req.query.onlyNew === "true";
  const page = q.page ?? 1;
  const limit = q.limit ?? 24;
  const settings = await getSettings();
  const price = retailPriceSql(settings);

  const conds: SQL[] = [visibleSql];
  if (q.search && q.search.trim()) {
    const term = `%${q.search.trim()}%`;
    conds.push(or(ilike(productsTable.name, term), ilike(productsTable.sku, term))!);
  }
  if (q.categoryId) {
    conds.push(inArray(productsTable.categoryId, await categoryWithChildren(q.categoryId)));
  }
  if (q.minPrice !== undefined) conds.push(sql`${price} >= ${q.minPrice}`);
  if (q.maxPrice !== undefined) conds.push(sql`${price} <= ${q.maxPrice}`);
  if (onlyNew) conds.push(eq(productsTable.isNew, true));
  const where = and(...conds);

  const order: SQL[] = (() => {
    switch (q.sort) {
      case "newest":
        return [desc(productsTable.firstSeenAt), desc(productsTable.id)];
      case "price_asc":
        return [sql`${price} asc`, asc(productsTable.id)];
      case "price_desc":
        return [sql`${price} desc`, asc(productsTable.id)];
      case "name":
        return [asc(productsTable.name), asc(productsTable.id)];
      default:
        return [
          sql`(products.image_url is not null) desc`,
          desc(productsTable.salesCount),
          desc(productsTable.isFeatured),
          desc(productsTable.isNew),
          desc(productsTable.id),
        ];
    }
  })();

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(productsTable)
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: sql<number>`count(*)::int` }).from(productsTable).where(where),
  ]);

  const total = totalRows[0]?.total ?? 0;
  res.json({
    items: await serializeProducts(rows),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

async function loadDetails(p: ProductRow, log: { warn: (o: object, m: string) => void }) {
  if (p.detailsFetchedAt) return p;
  try {
    const html = await fetchHtml(p.supplierUrl, 6000, 0);
    const d = parseProductDetails(html, p.sku);
    const [updated] = await db
      .update(productsTable)
      .set({
        article: d.article,
        description: d.description,
        images: d.images,
        detailsFetchedAt: new Date(),
      })
      .where(eq(productsTable.id, p.id))
      .returning();
    return updated ?? p;
  } catch (err) {
    log.warn({ err, productId: p.id }, "Could not fetch supplier product details");
    return p;
  }
}

router.get("/products/:id", async (req, res) => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Невірний id" });
    return;
  }
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!row || !row.isActive) {
    res.status(404).json({ error: "Товар не знайдено" });
    return;
  }
  const full = await loadDetails(row, req.log);
  const [base] = await serializeProducts([full]);
  const cats = await categoryNames();
  const breadcrumbs: { id: number; name: string }[] = [];
  let cur = full.categoryId;
  while (cur !== null && cur !== undefined) {
    const c = cats.get(cur);
    if (!c) break;
    breadcrumbs.unshift({ id: cur, name: c.name });
    cur = c.parentId;
  }
  const images = new Set<string>();
  if (full.images && full.images.length > 0) {
    for (const i of full.images) images.add(i);
  } else {
    if (full.imageUrl) images.add(full.imageUrl);
    if (full.image2Url) images.add(full.image2Url);
  }
  res.json({
    ...base,
    article: full.article,
    description: full.description,
    seoTitle: full.seoTitle,
    seoDescription: full.seoDescription,
    images: [...images],
    breadcrumbs,
  });
});

router.get("/products/:id/related", async (req, res) => {
  const params = GetRelatedProductsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Невірний id" });
    return;
  }
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!row || !row.categoryId) {
    res.json([]);
    return;
  }
  const rows = await db
    .select()
    .from(productsTable)
    .where(
      and(visibleSql, eq(productsTable.categoryId, row.categoryId), sql`products.id <> ${row.id}`),
    )
    .orderBy(sql`md5(products.id::text || ${String(row.id)})`)
    .limit(12);
  res.json(await serializeProducts(rows));
});

router.get("/storefront/highlights", async (_req, res) => {
  const daySeed = new Date().toISOString().slice(0, 10);
  const [newArrivals, bestsellers, featuredPinned, categories, totals, delivered, lastRun] =
    await Promise.all([
      db
        .select()
        .from(productsTable)
        .where(and(visibleSql, eq(productsTable.isNew, true), sql`products.image_url is not null`))
        .orderBy(desc(productsTable.firstSeenAt), desc(productsTable.id))
        .limit(12),
      db
        .select()
        .from(productsTable)
        .where(and(visibleSql, sql`products.image_url is not null`))
        .orderBy(desc(productsTable.salesCount), sql`md5(products.id::text || ${daySeed})`)
        .limit(12),
      db
        .select()
        .from(productsTable)
        .where(and(visibleSql, eq(productsTable.isFeatured, true)))
        .orderBy(desc(productsTable.updatedAt))
        .limit(12),
      listVisibleCategories(),
      db.select({ n: sql<number>`count(*)::int` }).from(productsTable).where(visibleSql),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(ordersTable)
        .where(eq(ordersTable.status, "delivered")),
      getLastFinishedRun(),
    ]);

  let featured = featuredPinned;
  if (featured.length < 4) {
    featured = await db
      .select()
      .from(productsTable)
      .where(and(visibleSql, sql`products.image_url is not null`))
      .orderBy(desc(productsTable.isFeatured), sql`md5(products.id::text || ${daySeed + "f"})`)
      .limit(12);
  }

  const top = categories
    .filter((c) => c.parentId !== null)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 8);

  res.json({
    newArrivals: await serializeProducts(newArrivals),
    bestsellers: await serializeProducts(bestsellers),
    featured: await serializeProducts(featured),
    topCategories: top.length > 0 ? top : categories.slice(0, 8),
    stats: {
      totalProducts: totals[0]?.n ?? 0,
      totalCategories: categories.length,
      ordersDelivered: delivered[0]?.n ?? 0,
      lastSyncAt: lastRun?.finishedAt?.toISOString() ?? null,
    },
  });
});

export default router;
