import {
  db,
  categoriesTable,
  productsTable,
  priceChangesTable,
  syncRunsTable,
  syncSourcesTable,
  type SyncRunRow,
} from "@workspace/db";
import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { logger } from "./logger";
import { getSettings, kyivNow } from "./settings";
import { runSeo } from "./seo";
import {
  DEFAULT_SOURCE_CAT_ID,
  SUPPLIER_ROOT_PATH,
  absUrl,
  fetchHtml,
  hasSupplierCredentials,
  listingPagePath,
  parseCategoryTree,
  supplierLogin,
  parseListing,
  parseProductStock,
  type ListedProduct,
  type SupplierGroup,
} from "./supplier";

const CONCURRENCY = 4;
const PAGE_SIZE = 52;

let activeRunId: number | null = null;

export function isSyncRunning(): boolean {
  return activeRunId !== null;
}

/** Refreshes the list of supplier top-level categories and returns the tree. */
export async function refreshSources(): Promise<SupplierGroup[]> {
  const html = await fetchHtml(SUPPLIER_ROOT_PATH);
  const tree = parseCategoryTree(html);
  if (tree.length === 0) throw new Error("Не вдалося прочитати дерево категорій постачальника");
  const existing = await db.select().from(syncSourcesTable);
  const anyEnabled = existing.some((s) => s.enabled);
  for (const [i, g] of tree.entries()) {
    await db
      .insert(syncSourcesTable)
      .values({
        supplierCatId: g.supplierCatId,
        name: g.name,
        url: absUrl(g.path),
        subcategoryCount: g.children.length,
        sortOrder: i,
        enabled: !anyEnabled && g.supplierCatId === DEFAULT_SOURCE_CAT_ID,
      })
      .onConflictDoUpdate({
        target: syncSourcesTable.supplierCatId,
        set: {
          name: g.name,
          url: absUrl(g.path),
          subcategoryCount: g.children.length,
          sortOrder: i,
        },
      });
  }
  return tree;
}

export async function ensureSources(): Promise<void> {
  const rows = await db.select({ id: syncSourcesTable.supplierCatId }).from(syncSourcesTable).limit(1);
  if (rows.length === 0) await refreshSources();
}

async function upsertCategory(
  supplierCatId: string,
  name: string,
  path: string,
  parentId: number | null,
  sortOrder: number,
): Promise<number> {
  const slug = path.replace(/^\/ua\//, "").replace(/\/$/, "");
  const [row] = await db
    .insert(categoriesTable)
    .values({ supplierCatId, name, slug, url: absUrl(path), parentId, sortOrder })
    .onConflictDoUpdate({
      target: categoriesTable.supplierCatId,
      set: { name, slug, url: absUrl(path), parentId, sortOrder },
    })
    .returning({ id: categoriesTable.id });
  return row!.id;
}

interface CrawlTarget {
  categoryId: number;
  sourceCatId: string;
  path: string;
}

class RunState {
  pagesScanned = 0;
  pagesTotal = 0;
  productsSeen = 0;
  added = 0;
  updated = 0;
  backInStock = 0;
  wentOutOfStock = 0;
  currentStep = "";
  seenSkus = new Set<string>();
  /** SKUs the listing showed as an open range ("понад 100") — exact count needs the product page. */
  openRangeSkus = new Set<string>();
  failedCategoryIds = new Set<number>();
  lastFlush = 0;
  constructor(public runId: number) {}

  async flush(force = false) {
    if (!force && Date.now() - this.lastFlush < 1500) return;
    this.lastFlush = Date.now();
    await db
      .update(syncRunsTable)
      .set({
        pagesScanned: this.pagesScanned,
        pagesTotal: this.pagesTotal || null,
        productsSeen: this.productsSeen,
        added: this.added,
        updated: this.updated,
        backInStock: this.backInStock,
        wentOutOfStock: this.wentOutOfStock,
        currentStep: this.currentStep,
      })
      .where(eq(syncRunsTable.id, this.runId));
  }
}

async function saveProducts(state: RunState, target: CrawlTarget, items: ListedProduct[], runStart: Date) {
  // A listing page can repeat the same product; one upsert may touch each row only once.
  const fresh: ListedProduct[] = [];
  for (const p of items) {
    if (state.seenSkus.has(p.sku)) continue;
    state.seenSkus.add(p.sku);
    if (p.stockQty !== null && p.stockQty > 0 && p.stockQtyMax !== p.stockQty) state.openRangeSkus.add(p.sku);
    fresh.push(p);
  }
  if (fresh.length === 0) return;

  const existing = await db
    .select({
      id: productsTable.id,
      sku: productsTable.sku,
      inStock: productsTable.inStock,
      supplierPrice: productsTable.supplierPrice,
    })
    .from(productsTable)
    .where(inArray(productsTable.sku, fresh.map((p) => p.sku)));
  const existingMap = new Map(existing.map((e) => [e.sku, e.inStock]));
  const priceChanges = [];
  for (const e of existing) {
    const next = fresh.find((p) => p.sku === e.sku)?.price ?? null;
    if (next !== null && e.supplierPrice !== null && Math.abs(next - e.supplierPrice) >= 0.01) {
      priceChanges.push({ productId: e.id, oldPrice: e.supplierPrice, newPrice: next });
    }
  }

  const now = new Date();
  const available = (p: ListedProduct) => (p.stockQty === null ? p.price !== null : p.stockQty > 0);
  await db
    .insert(productsTable)
    .values(
      fresh.map((p) => ({
        sku: p.sku,
        supplierProductId: p.supplierProductId,
        name: p.name,
        article: p.article,
        supplierUrl: absUrl(p.path),
        imageUrl: p.imageUrl,
        image2Url: p.image2Url,
        supplierPrice: p.price,
        supplierOldPrice: p.oldPrice,
        stockQty: p.stockQty,
        stockQtyMax: p.stockQtyMax,
        categoryId: target.categoryId,
        sourceCatId: target.sourceCatId,
        isNew: p.isNew,
        deliveryDays: p.deliveryDays,
        inStock: available(p),
        firstSeenAt: now,
        lastSeenAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: productsTable.sku,
      set: {
        supplierProductId: sql`excluded.supplier_product_id`,
        name: sql`excluded.name`,
        article: sql`coalesce(excluded.article, products.article)`,
        supplierUrl: sql`excluded.supplier_url`,
        imageUrl: sql`excluded.image_url`,
        image2Url: sql`excluded.image2_url`,
        supplierPrice: sql`coalesce(excluded.supplier_price, products.supplier_price)`,
        supplierOldPrice: sql`excluded.supplier_old_price`,
        // Listing shows a range ("10...50", "понад 100"): keep yesterday's exact count while it still fits
        // the range, until the product page refines it.
        stockQty: sql`case when ${keepExactSql} then products.stock_qty else excluded.stock_qty end`,
        stockQtyMax: sql`case when ${keepExactSql} then products.stock_qty_max else excluded.stock_qty_max end`,
        categoryId: sql`excluded.category_id`,
        sourceCatId: sql`excluded.source_cat_id`,
        isNew: sql`excluded.is_new`,
        deliveryDays: sql`excluded.delivery_days`,
        inStock: sql`excluded.in_stock`,
        lastSeenAt: now,
      },
    });

  if (priceChanges.length > 0) await db.insert(priceChangesTable).values(priceChanges);

  for (const p of fresh) {
    state.productsSeen++;
    const was = existingMap.get(p.sku);
    const nowAvailable = available(p);
    if (was === undefined) state.added++;
    else {
      state.updated++;
      if (was === false && nowAvailable) state.backInStock++;
      if (was === true && !nowAvailable) state.wentOutOfStock++;
    }
  }
  void runStart;
}

/** Short error text — DB errors otherwise dump every query parameter into the log. */
function errorText(err: unknown): string {
  const e = err as { message?: string; cause?: { message?: string } };
  const msg = e?.cause?.message ?? e?.message ?? String(err);
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}

async function pool<T>(items: T[], worker: (item: T) => Promise<void>) {
  let index = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++]!;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/** Upsert guard: the listing shows a range and yesterday's exact count still lies inside it. */
const keepExactSql = sql`(excluded.stock_qty is not null and excluded.stock_qty > 0
  and excluded.stock_qty_max is distinct from excluded.stock_qty
  and products.stock_qty_max = products.stock_qty
  and products.stock_qty >= excluded.stock_qty
  and (excluded.stock_qty_max is null or products.stock_qty <= excluded.stock_qty_max))`;

const REFINE_CONCURRENCY = 4;
const REFINE_BUDGET_MS = 45 * 60_000;

/**
 * Listings show bigger stocks as ranges ("5...10", "10...50", "понад 100"); the product page often carries
 * the exact count. Refines every in-stock product whose quantity is not exact, biggest stocks first.
 */
export async function refineOpenRanges(state?: RunState) {
  const skus = state ? [...state.openRangeSkus] : [];
  const rows = await db
    .select({ id: productsTable.id, sku: productsTable.sku, url: productsTable.supplierUrl })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.inStock, true),
        skus.length > 0
          ? or(isNull(productsTable.stockQtyMax), ne(productsTable.stockQtyMax, productsTable.stockQty), inArray(productsTable.sku, skus))
          : or(isNull(productsTable.stockQtyMax), ne(productsTable.stockQtyMax, productsTable.stockQty)),
        sql`${productsTable.stockQty} > 0`,
      ),
    )
    .orderBy(desc(productsTable.stockQty));
  if (rows.length === 0) return;
  const started = Date.now();
  let done = 0;
  let refined = 0;
  let failed = 0;
  let unparsed = 0;
  const setStep = async (force = false) => {
    if (!state) return;
    state.currentStep = `Уточнюю точні залишки: ${done} з ${rows.length}`;
    await state.flush(force);
  };
  await setStep(true);
  let index = 0;
  let relogin: Promise<boolean> | null = null;
  const worker = async () => {
    while (index < rows.length && Date.now() - started < REFINE_BUDGET_MS) {
      const row = rows[index++]!;
      const path = row.url.replace(/^https?:\/\/[^/]+/, "");
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          let html = await fetchHtml(path, 20000, 0);
          let stock = parseProductStock(html);
          if (!stock && html.includes("/register/?back_product=")) {
            // The wholesale session dropped mid-run (guest page has no stock): log in again once and retry.
            relogin ??= supplierLogin().finally(() => setTimeout(() => (relogin = null), 30_000));
            await relogin;
            html = await fetchHtml(path, 20000, 0);
            stock = parseProductStock(html);
          }
          if (stock && stock.max !== null) {
            await db
              .update(productsTable)
              .set({ stockQty: stock.min, stockQtyMax: stock.max, inStock: stock.min > 0 })
              .where(eq(productsTable.id, row.id));
            refined++;
          } else unparsed++;
          break;
        } catch (err) {
          if (attempt === 2) {
            failed++;
            if (failed <= 5) logger.warn({ error: errorText(err), sku: row.sku }, "Sync: stock refine failed");
          } else {
            // The supplier throttles bursts; back off before retrying.
            await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
          }
        }
      }
      done++;
      await setStep();
    }
  };
  await Promise.all(Array.from({ length: Math.min(REFINE_CONCURRENCY, rows.length) }, worker));
  logger.info({ total: rows.length, refined, failed, unparsed, ms: Date.now() - started }, "Sync: open-range stock refined");
}

async function executeRun(runId: number, runStart: Date) {
  const state = new RunState(runId);
  state.currentStep = "Читаю категорії постачальника";
  await state.flush(true);

  if (hasSupplierCredentials()) {
    state.currentStep = "Входжу в оптовий кабінет постачальника";
    await state.flush(true);
    const ok = await supplierLogin().catch((err: unknown) => {
      logger.warn({ err }, "Supplier login failed");
      return false;
    });
    logger.info({ ok }, "Supplier login");
    if (!ok) throw new Error("Не вдалося увійти в кабінет toysi.ua — перевірте телефон і пароль");
  }

  const tree = await refreshSources();
  const enabled = await db
    .select()
    .from(syncSourcesTable)
    .where(eq(syncSourcesTable.enabled, true));
  const enabledIds = new Set(enabled.map((e) => e.supplierCatId));
  if (enabledIds.size === 0) throw new Error("Не вибрано жодної категорії для синхронізації");

  const targets: CrawlTarget[] = [];
  for (const [gi, group] of tree.entries()) {
    if (!enabledIds.has(group.supplierCatId)) continue;
    const groupId = await upsertCategory(group.supplierCatId, group.name, group.path, null, gi);
    if (group.children.length === 0) {
      targets.push({ categoryId: groupId, sourceCatId: group.supplierCatId, path: group.path });
    }
    for (const [ci, child] of group.children.entries()) {
      const childId = await upsertCategory(child.supplierCatId, child.name, child.path, groupId, ci);
      targets.push({ categoryId: childId, sourceCatId: group.supplierCatId, path: child.path });
    }
  }

  // Phase 1: first page of every category (discovers page counts).
  state.currentStep = `Сканую ${targets.length} категорій`;
  state.pagesTotal = targets.length;
  await state.flush(true);
  const followUps: { target: CrawlTarget; offset: number }[] = [];
  await pool(targets, async (target) => {
    try {
      const page = parseListing(await fetchHtml(listingPagePath(target.path, 0)));
      for (let off = PAGE_SIZE; off <= page.maxOffset; off += PAGE_SIZE) {
        followUps.push({ target, offset: off });
      }
      state.pagesTotal += Math.floor(page.maxOffset / PAGE_SIZE);
      await saveProducts(state, target, page.products, runStart);
    } catch (err) {
      state.failedCategoryIds.add(target.categoryId);
      logger.warn({ error: errorText(err), path: target.path }, "Sync: category page failed");
    }
    state.pagesScanned++;
    await state.flush();
  });

  // Phase 2: remaining pages.
  state.currentStep = "Завантажую товари";
  await pool(followUps, async ({ target, offset }) => {
    try {
      const page = parseListing(await fetchHtml(listingPagePath(target.path, offset)));
      await saveProducts(state, target, page.products, runStart);
    } catch (err) {
      state.failedCategoryIds.add(target.categoryId);
      logger.warn({ error: errorText(err), path: target.path, offset }, "Sync: listing page failed");
    }
    state.pagesScanned++;
    await state.flush();
  });

  if (state.productsSeen === 0) {
    throw new Error("Постачальник не повернув жодного товару — склад не змінено");
  }

  // Phase 3: everything from the scanned categories that disappeared from the warehouse is sold out.
  state.currentStep = "Позначаю товари, яких більше немає на складі";
  await state.flush(true);
  const scannedIds = targets
    .map((t) => t.categoryId)
    .filter((id) => !state.failedCategoryIds.has(id));
  if (scannedIds.length > 0) {
    const gone = await db
      .update(productsTable)
      .set({ inStock: false })
      .where(
        and(
          eq(productsTable.inStock, true),
          inArray(productsTable.categoryId, scannedIds),
          or(isNull(productsTable.lastSeenAt), lt(productsTable.lastSeenAt, runStart)),
        ),
      )
      .returning({ id: productsTable.id });
    state.wentOutOfStock += gone.length;
  }

  // Phase 4: listings cap big stocks at "понад 100"; the product page has the exact count.
  await refineOpenRanges(state);

  const settings = await getSettings();
  if (settings.seoAutoAfterSync) {
    state.currentStep = "Оновлюю SEO товарів";
    await state.flush(true);
    await runSeo().catch((err: unknown) => logger.warn({ err }, "Auto SEO after sync failed"));
  }

  state.currentStep =
    state.failedCategoryIds.size > 0
      ? `Готово, але ${state.failedCategoryIds.size} категорій не відповіли`
      : "Готово";
  await state.flush(true);
}

export async function startSync(trigger: "manual" | "scheduled"): Promise<SyncRunRow | null> {
  if (activeRunId !== null) return null;
  const runStart = new Date();
  const [run] = await db
    .insert(syncRunsTable)
    .values({ trigger, status: "running", startedAt: runStart, currentStep: "Старт" })
    .returning();
  activeRunId = run!.id;
  const runId = run!.id;
  logger.info({ runId, trigger }, "Sync started");

  void executeRun(runId, runStart)
    .then(async () => {
      await db
        .update(syncRunsTable)
        .set({ status: "success", finishedAt: new Date() })
        .where(eq(syncRunsTable.id, runId));
      logger.info({ runId }, "Sync finished");
    })
    .catch(async (err: unknown) => {
      logger.error({ err, runId }, "Sync failed");
      await db
        .update(syncRunsTable)
        .set({
          status: "failed",
          finishedAt: new Date(),
          errorMessage: err instanceof Error ? err.message : String(err),
        })
        .where(eq(syncRunsTable.id, runId));
    })
    .finally(() => {
      activeRunId = null;
    });

  return run!;
}

export async function getCurrentRun(): Promise<SyncRunRow | null> {
  if (activeRunId === null) return null;
  const [row] = await db.select().from(syncRunsTable).where(eq(syncRunsTable.id, activeRunId));
  return row ?? null;
}

export async function getLastFinishedRun(): Promise<SyncRunRow | null> {
  const [row] = await db
    .select()
    .from(syncRunsTable)
    .where(sql`${syncRunsTable.status} <> 'running'`)
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(1);
  return row ?? null;
}

/** Next scheduled run time (Kyiv time based). */
export function nextScheduledAt(autoSyncEnabled: boolean, hour: number, lastRunDay: string | null): Date | null {
  if (!autoSyncEnabled) return null;
  const now = new Date();
  const { day } = kyivNow(now);
  const local = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Kyiv" })).getTime();
  const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const offsetMs = local - utc;
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  let target = Date.UTC(y, m - 1, d, hour, 0, 0) - offsetMs;
  if (lastRunDay === day) target += 24 * 3600_000;
  else if (target < now.getTime()) target = now.getTime() + 5 * 60_000;
  return new Date(target);
}

async function lastRunKyivDay(): Promise<string | null> {
  const [row] = await db
    .select({ startedAt: syncRunsTable.startedAt })
    .from(syncRunsTable)
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(1);
  return row ? kyivNow(row.startedAt).day : null;
}

export { lastRunKyivDay };

async function schedulerTick() {
  try {
    if (activeRunId !== null) return;
    const settings = await getSettings();
    if (!settings.autoSyncEnabled) return;
    const { hour, day } = kyivNow();
    if (hour < settings.autoSyncHour) return;
    if ((await lastRunKyivDay()) === day) return;
    await startSync("scheduled");
  } catch (err) {
    logger.error({ err }, "Sync scheduler tick failed");
  }
}

export async function initSync() {
  // Runs interrupted by a restart can never finish.
  await db
    .update(syncRunsTable)
    .set({ status: "failed", finishedAt: new Date(), errorMessage: "Сервер перезапустився під час синхронізації" })
    .where(eq(syncRunsTable.status, "running"));
  await getSettings();
  try {
    await ensureSources();
  } catch (err) {
    logger.warn({ err }, "Could not load supplier categories on startup");
  }
  setInterval(() => void schedulerTick(), 5 * 60_000);
  setTimeout(() => void schedulerTick(), 20_000);
}
