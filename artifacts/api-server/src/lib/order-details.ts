import { db, orderItemsTable, type OrderRow } from "@workspace/db";
import { asc, inArray } from "drizzle-orm";
import { toOrderDetail } from "./serialize";
import { normalizeTtn, parcelStatuses } from "./parcel";

/** Full order details (items + live Nova Poshta status when a ТТН is set), in the given order. */
export async function orderDetails(orders: OrderRow[], includeProfit: boolean) {
  if (!orders.length) return [];
  const [items, parcels] = await Promise.all([
    db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orders.map((o) => o.id))).orderBy(asc(orderItemsTable.id)),
    parcelStatuses(orders.filter((o) => o.ttn).map((o) => ({ ttn: o.ttn!, phone: o.phone }))),
  ]);
  return orders.map((o) =>
    toOrderDetail(o, items.filter((i) => i.orderId === o.id), includeProfit, o.ttn ? (parcels.get(normalizeTtn(o.ttn)) ?? null) : null),
  );
}
