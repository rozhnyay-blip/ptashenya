/**
 * Sends shop data to the owner's CRM panel «Моє» (a separate published app).
 *  - every new order → POST {MOIE_URL}/api/webhooks/messages (appears as a message in the panel)
 *  - every 60 s → POST {MOIE_URL}/api/webhooks/commerce (aggregate stock + order totals by status)
 * Both use this site's Bearer token from the panel (secret MOIE_WEBHOOK_TOKEN).
 * Without MOIE_URL / MOIE_WEBHOOK_TOKEN the integration is off; orders are never blocked by it.
 */
import { db, productsTable, ordersTable, type OrderRow, type OrderItemRow } from "@workspace/db";
import { count, sql } from "drizzle-orm";
import { logger } from "./logger";
import { visibleSql } from "../routes/catalog";

const PANEL_STATUSES = ["new", "confirmed", "ordered_from_supplier", "shipped", "delivered", "cancelled", "returned"] as const;
const DELIVERY: Record<string, string> = { nova_poshta: "Нова Пошта", ukrposhta: "Укрпошта", courier: "Кур'єр", pickup: "Самовивіз" };
const PAYMENT: Record<string, string> = { cod: "Накладений платіж", card_transfer: "Переказ на картку" };

function config() {
  const base = process.env.MOIE_URL;
  const raw = process.env.MOIE_WEBHOOK_TOKEN?.trim();
  if (!base || !raw) return null;
  // Tolerate the whole code example from the panel being pasted: take the value after "Bearer".
  const token = raw.match(/Bearer\s+([^\s"'`]+)/)?.[1] ?? raw;
  const url = new URL(base);
  if (url.protocol !== "https:") throw new Error("MOIE_URL must be https");
  const root = url.origin + url.pathname.replace(/\/+$/, "");
  return { token, messages: `${root}/api/webhooks/messages`, commerce: `${root}/api/webhooks/commerce` };
}

async function post(url: string, token: string, body: unknown): Promise<number> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
  });
  return res.status;
}

const uah = (n: number) => `${n.toLocaleString("uk-UA", { maximumFractionDigits: 2 })} грн`;

export function orderMessage(order: OrderRow, items: OrderItemRow[]) {
  const lines = items.map((i) => `• ${i.name} (код ${i.sku}) — ${i.quantity} × ${uah(Number(i.price))}`);
  const delivery = [DELIVERY[order.deliveryMethod] ?? order.deliveryMethod, order.city, order.deliveryAddress].filter(Boolean).join(", ");
  const message = [
    `Нове замовлення №${order.number} на ${uah(Number(order.total))}`,
    "",
    ...lines,
    "",
    `Покупець: ${order.customerName}, ${order.phone}${order.email ? `, ${order.email}` : ""}`,
    `Доставка: ${delivery}`,
    `Оплата: ${PAYMENT[order.paymentMethod] ?? order.paymentMethod}`,
    ...(order.comment ? [`Коментар: ${order.comment}`] : []),
  ].join("\n");
  return {
    customerName: order.customerName,
    phone: order.phone,
    ...(order.email ? { email: order.email } : {}),
    subject: `Замовлення №${order.number} — ${uah(Number(order.total))}`,
    message,
  };
}

/** Fire-and-forget: sends the new order to the panel, retrying a few times if it is unreachable. */
export function crmConfigured() {
  try {
    return config();
  } catch {
    return null;
  }
}

export function sendOrderToCrm(order: OrderRow, items: OrderItemRow[]) {
  let cfg: ReturnType<typeof config>;
  try {
    cfg = config();
  } catch {
    logger.error({}, "CRM: invalid MOIE_URL");
    return;
  }
  if (!cfg) return;
  const { token, messages } = cfg;
  const body = orderMessage(order, items);
  const delays = [0, 30_000, 5 * 60_000];
  const attempt = async (n: number): Promise<void> => {
    try {
      const status = await post(messages, token, body);
      if (status >= 200 && status < 300) {
        logger.info({ orderId: order.id }, "CRM: order sent");
        return;
      }
      logger.error({ orderId: order.id, status }, "CRM: order rejected");
      if (status === 400 || status === 401 || status === 403) return; // retrying won't help
    } catch {
      logger.error({ orderId: order.id, attempt: n + 1 }, "CRM: order send failed");
    }
    if (n + 1 < delays.length) setTimeout(() => void attempt(n + 1), delays[n + 1]).unref();
  };
  void attempt(0);
}

async function commerceSnapshot() {
  const [products] = await db.select({ value: count() }).from(productsTable).where(sql`products.in_stock = true`);
  const [visible] = await db
    .select({ value: count() })
    .from(productsTable)
    .where(visibleSql);
  const grouped = await db
    .select({
      status: ordersTable.status,
      count: count(),
      amount: sql<number>`coalesce(sum(${ordersTable.total}), 0)`.mapWith(Number),
      cost: sql<number>`coalesce(sum(${ordersTable.cost}), 0)`.mapWith(Number),
      itemsCount: sql<number>`coalesce(sum(${ordersTable.itemsCount}), 0)`.mapWith(Number),
    })
    .from(ordersTable)
    .groupBy(ordersTable.status);
  return {
    capturedAt: new Date().toISOString(),
    currency: "UAH",
    availableProducts: products!.value,
    availableOnStorefront: visible!.value,
    // orders.cost = supplier (toysi.ua) price of the items at order time, i.e. the real purchase cost.
    costBasisConfirmed: true,
    orders: PANEL_STATUSES.map(
      (status) => grouped.find((g) => g.status === status) ?? { status, count: 0, amount: 0, cost: 0, itemsCount: 0 },
    ),
  };
}

/** Starts the once-a-minute shop summary for the panel (no customer data in it). */
export function startCrmSync() {
  let cfg: ReturnType<typeof config>;
  try {
    cfg = config();
  } catch {
    logger.error({}, "CRM: invalid MOIE_URL");
    return;
  }
  if (!cfg) {
    logger.info({}, "CRM: not configured, skipping");
    return;
  }
  const { token, commerce } = cfg;
  let busy = false;
  let lastOk: boolean | null = null;
  const sync = async () => {
    if (busy) return;
    busy = true;
    try {
      const status = await post(commerce, token, await commerceSnapshot());
      const ok = status >= 200 && status < 300;
      if (!ok) logger.error({ status }, "CRM: summary rejected");
      else if (lastOk !== true) logger.info({}, "CRM: summary sync working");
      lastOk = ok;
    } catch {
      if (lastOk !== false) logger.error({}, "CRM: summary sync failed; retrying every minute");
      lastOk = false;
    } finally {
      busy = false;
    }
  };
  void sync();
  setInterval(() => void sync(), 60_000).unref();
}
