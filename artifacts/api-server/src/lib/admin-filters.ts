import { db, productsTable, categoriesTable } from "@workspace/db";
import { and, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

export interface AdminProductQuery {
  search?: string;
  categoryId?: number;
  stock?: "all" | "in_stock" | "out_of_stock" | "hidden";
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
  if (q.stock === "in_stock") conds.push(and(eq(productsTable.inStock, true), eq(productsTable.isActive, true))!);
  if (q.stock === "out_of_stock") conds.push(eq(productsTable.inStock, false));
  if (q.stock === "hidden") conds.push(eq(productsTable.isActive, false));
  return conds.length ? and(...conds) : undefined;
}

/**
 * A product counts towards stock money only when a customer can actually buy it in the store:
 * in stock at the supplier, not hidden, priced, and from an enabled supplier category.
 */
export const sellableSql = sql`(products.in_stock and products.is_active
  and coalesce(products.price_override, products.supplier_price, 0) > 0
  and products.source_cat_id in (select supplier_cat_id from sync_sources where enabled))`;

/** Guaranteed units (lower bound of the supplier's range). */
export const qtyMinSql = sql`(case when ${sellableSql} then coalesce(products.stock_qty, 0) else 0 end)`;

/** Units at the top of the supplier's range; unknown upper bound falls back to the guaranteed count. */
export const qtyMaxSql = sql`(case when ${sellableSql} then coalesce(products.stock_qty_max, products.stock_qty, 0) else 0 end)`;
