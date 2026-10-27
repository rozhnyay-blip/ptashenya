import { db, productsTable, categoriesTable } from "@workspace/db";
import { and, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

export interface AdminProductQuery {
  search?: string;
  categoryId?: number;
  stock?: "all" | "available" | "in_stock" | "on_order" | "out_of_stock" | "hidden";
  /** Supplier stock bounds (the guaranteed/lower count). */
  minQty?: number;
  maxQty?: number;
}

/** WHERE clause shared by the admin product list, its money summary and the CSV export. */
export async function adminProductFilter(q: AdminProductQuery): Promise<SQL | undefined> {
  const conds: SQL[] = [];
  if (q.search && q.search.trim()) {
    const term = `%${q.search.trim()}%`;
    conds.push(
      or(ilike(productsTable.name, term), ilike(productsTable.sku, term), ilike(productsTable.article, term))!,
    );
  }
  if (q.categoryId) {
    const children = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.parentId, q.categoryId));
    conds.push(inArray(productsTable.categoryId, [q.categoryId, ...children.map((c) => c.id)]));
  }
  if (q.stock === "available") conds.push(and(eq(productsTable.inStock, true), eq(productsTable.isActive, true))!);
  if (q.stock === "in_stock") conds.push(and(eq(productsTable.inStock, true), eq(productsTable.isActive, true), readyToShipSql)!);
  if (q.stock === "on_order") conds.push(and(eq(productsTable.inStock, true), eq(productsTable.isActive, true), sql`not ${readyToShipSql}`)!);
  if (q.stock === "out_of_stock") conds.push(eq(productsTable.inStock, false));
  if (q.stock === "hidden") conds.push(eq(productsTable.isActive, false));
  if (q.minQty !== undefined) conds.push(sql`(products.in_stock and products.stock_qty >= ${q.minQty})`);
  if (q.maxQty !== undefined) conds.push(sql`(products.in_stock and coalesce(products.stock_qty, 1) <= ${q.maxQty})`);
  return conds.length ? and(...conds) : undefined;
}

/**
 * A product counts towards stock money only when a customer can actually buy it in the store:
 * in stock at the supplier, not hidden, priced, and from an enabled supplier category.
 */
export const sellableSql = sql`(products.in_stock and products.is_active
  and coalesce(products.price_override, products.supplier_price, 0) > 0
  and products.source_cat_id in (select supplier_cat_id from sync_sources where enabled))`;

/**
 * Ships within ~3 days: on the supplier's own warehouse. "Під замовлення" items come from a partner
 * warehouse in up to 7 days and are excluded from admin stock figures (owner decision).
 */
export const readyToShipSql = sql`(products.delivery_days is null or products.delivery_days <= 3)`;

/** Sellable and ready to ship — the base for every admin "in stock" figure. */
export const readySql = sql`(${sellableSql} and ${readyToShipSql})`;

/** Sellable but shipped "під замовлення" from a partner warehouse (up to 7 days). */
export const onOrderSql = sql`(${sellableSql} and not ${readyToShipSql})`;

/**
 * Unit counters for stock money over a base condition (which products count at all).
 * one: 1 per product; all: every unit (range minimum when only a range is known);
 * approx: 1 when that product's count is only a range.
 */
export function unitSqls(base: SQL) {
  const has = sql`${base} and coalesce(products.stock_qty, 1) > 0`;
  return {
    one: sql`(case when ${has} then 1 else 0 end)`,
    all: sql`(case when ${has} then coalesce(products.stock_qty, 1) else 0 end)`,
    approx: sql`(case when ${has}
      and (products.stock_qty is null or products.stock_qty_max is null or products.stock_qty_max <> products.stock_qty) then 1 else 0 end)`,
  };
}

/** Which products a stock-money figure covers for a given stock filter (default: ready to ship). */
export function moneyBaseSql(stock: AdminProductQuery["stock"]): SQL {
  if (stock === "on_order") return onOrderSql;
  if (stock === "available") return sellableSql;
  return readySql;
}

const ready = unitSqls(readySql);
/** Stock money counts one unit of every product that is ready to ship and sellable in the store. */
export const oneUnitSql = ready.one;
/** "All units" stock money for ready-to-ship products. */
export const allUnitsSql = ready.all;
/** 1 when the product is counted in allUnitsSql but its count is only known as a range. */
export const approxUnitsSql = ready.approx;
