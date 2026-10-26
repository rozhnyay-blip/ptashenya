import { db, productsTable, categoriesTable } from "@workspace/db";
import { and, eq, ilike, inArray, or, type SQL } from "drizzle-orm";

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
