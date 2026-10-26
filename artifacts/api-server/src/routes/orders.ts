import { Router, type IRouter } from "express";
import {
  db,
  productsTable,
  ordersTable,
  orderItemsTable,
  orderEventsTable,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { CreateOrderBody, LookupOrderQueryParams } from "@workspace/api-zod";
import { getSettings, retailPrice } from "../lib/settings";
import { toOrderDetail } from "../lib/serialize";
import { resolveIdentity } from "../middlewares/auth";

const router: IRouter = Router();

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-9);
}

router.post("/orders", async (req, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Перевірте дані замовлення", details: parsed.error.issues });
    return;
  }
  const input = parsed.data;
  if (phoneDigits(input.phone).length < 9) {
    res.status(400).json({ error: "Вкажіть коректний номер телефону" });
    return;
  }

  if (input.deliveryMethod !== "nova_poshta") {
    res.status(400).json({ error: "Доставляємо лише Новою Поштою" });
    return;
  }
  if (!input.deliveryAddress?.trim()) {
    res.status(400).json({ error: "Оберіть відділення або поштомат Нової Пошти" });
    return;
  }

  const qtyById = new Map<number, number>();
  for (const it of input.items) qtyById.set(it.productId, (qtyById.get(it.productId) ?? 0) + it.quantity);

  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, [...qtyById.keys()]));
  const unavailable = [...qtyById.keys()].filter((id) => {
    const p = products.find((x) => x.id === id);
    return !p || !p.isActive || !p.inStock || !((p.priceOverride ?? p.supplierPrice ?? 0) > 0);
  });
  if (unavailable.length > 0) {
    const names = products.filter((p) => unavailable.includes(p.id)).map((p) => p.name);
    res.status(400).json({
      error:
        names.length > 0
          ? `Цих товарів вже немає в наявності: ${names.join(", ")}`
          : "Деяких товарів вже немає в наявності",
      unavailableProductIds: unavailable,
    });
    return;
  }

  const tooMany = products.filter((p) => p.stockQty !== null && qtyById.get(p.id)! > p.stockQty);
  if (tooMany.length > 0) {
    res.status(400).json({
      error: tooMany.map((p) => `«${p.name}» — на складі лише ${p.stockQty} шт.`).join("; "),
    });
    return;
  }

  const settings = await getSettings();
  const lines = products.map((p) => {
    const quantity = qtyById.get(p.id)!;
    return {
      product: p,
      quantity,
      price: retailPrice(p.supplierPrice, p.priceOverride, settings),
    };
  });
  const total = Math.round(lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100;
  const cost =
    Math.round(lines.reduce((s, l) => s + Number(l.product.supplierPrice ?? 0) * l.quantity, 0) * 100) /
    100;
  if (total < Number(settings.minOrderAmount)) {
    res.status(400).json({ error: `Мінімальна сума замовлення — ${settings.minOrderAmount} грн` });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(ordersTable)
      .values({
        number: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        customerName: input.customerName.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
        city: input.city.trim(),
        deliveryMethod: input.deliveryMethod,
        deliveryAddress: input.deliveryAddress?.trim() || null,
        paymentMethod: input.paymentMethod,
        comment: input.comment?.trim() || null,
        status: "new",
        total,
        cost,
        itemsCount: lines.reduce((s, l) => s + l.quantity, 0),
      })
      .returning();
    const [numbered] = await tx
      .update(ordersTable)
      .set({ number: String(10000 + order!.id) })
      .where(eq(ordersTable.id, order!.id))
      .returning();
    const items = await tx
      .insert(orderItemsTable)
      .values(
        lines.map((l) => ({
          orderId: order!.id,
          productId: l.product.id,
          name: l.product.name,
          sku: l.product.sku,
          imageUrl: l.product.imageUrl,
          price: l.price,
          supplierPrice: l.product.supplierPrice,
          quantity: l.quantity,
        })),
      )
      .returning();
    await tx.insert(orderEventsTable).values({ orderId: order!.id, type: "order_created", status: "new" });
    for (const l of lines) {
      await tx
        .update(productsTable)
        .set({ salesCount: sql`${productsTable.salesCount} + ${l.quantity}` })
        .where(eq(productsTable.id, l.product.id));
    }
    return { order: numbered!, items };
  });

  req.log.info({ orderId: result.order.id, total }, "Order created");
  res.status(201).json(toOrderDetail(result.order, result.items, false));
});

router.get("/orders/lookup", async (req, res) => {
  const parsed = LookupOrderQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Вкажіть номер замовлення і телефон" });
    return;
  }
  const number = parsed.data.number.replace(/\D/g, "");
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.number, number));
  if (!order || phoneDigits(order.phone) !== phoneDigits(parsed.data.phone)) {
    res.status(404).json({ error: "Замовлення не знайдено" });
    return;
  }
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(and(eq(orderItemsTable.orderId, order.id)));
  res.json(toOrderDetail(order, items, false));
});

router.get("/me", async (req, res) => {
  try {
    const id = await resolveIdentity(req);
    res.json({ signedIn: !!id.userId, isAdmin: id.isAdmin, email: id.email });
  } catch (err) {
    req.log.error({ err }, "Failed to resolve identity");
    res.json({ signedIn: false, isAdmin: false, email: null });
  }
});

export default router;
