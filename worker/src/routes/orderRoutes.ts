import { Env } from "../types/env";
import { generateId, generateOrderRef } from "../utils/order";
import { HttpError } from "../utils/errors";
import { orderSchema, resendOrderOtpSchema, verifyOrderOtpSchema } from "../utils/validation";
import { readJson } from "../utils/http";
import { createOrderOtp, resendOrderOtp, verifyOrderOtp } from "../services/otpService";
import { sendOrderConfirmationEmail, sendOrderOtpEmail } from "../services/emailService";
import { generateOrderAiNotes } from "../services/aiService";

type ProductStock = {
  id: string;
  name: string;
  stock_qty: number;
  min_qty: number;
  max_daily_qty: number;
  price: number;
  active: number;
};

async function fetchProductMap(env: Env, productIds: string[]): Promise<Map<string, ProductStock>> {
  const placeholders = productIds.map(() => "?").join(", ");
  const { results } = await env.DB.prepare(
    `SELECT id, name, stock_qty, min_qty, max_daily_qty, price, active FROM products WHERE id IN (${placeholders})`
  )
    .bind(...productIds)
    .all<ProductStock>();
  return new Map(results.map((r) => [r.id, r]));
}

async function getTodayOrderedQty(env: Env, productId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(oi.quantity), 0) AS total_qty
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = ?
       AND DATE(o.created_at) = DATE('now')
       AND o.status != 'rejected'`
  )
    .bind(productId)
    .first<{ total_qty: number }>();
  return Number(row?.total_qty ?? 0);
}

export async function createOrder(request: Request, env: Env): Promise<{ order_ref: string; status: string }> {
  const body = await readJson<unknown>(request);
  const parsed = orderSchema.parse(body);

  const uniqueProductIds = [...new Set(parsed.items.map((item) => item.product_id))];
  const productMap = await fetchProductMap(env, uniqueProductIds);

  let totalAmount = 0;
  for (const item of parsed.items) {
    const product = productMap.get(item.product_id);
    if (!product || product.active !== 1) {
      throw new HttpError(`Product unavailable: ${item.product_id}`, 400);
    }
    if (item.quantity < product.min_qty) {
      throw new HttpError(`Minimum quantity for ${product.name} is ${product.min_qty}`, 400);
    }
    if (item.quantity > product.stock_qty) {
      throw new HttpError(`Insufficient stock for ${product.name}`, 400);
    }
    const todayQty = await getTodayOrderedQty(env, product.id);
    if (todayQty + item.quantity > product.max_daily_qty) {
      throw new HttpError(`Daily purchase limit exceeded for ${product.name}`, 400);
    }
    totalAmount += product.price * item.quantity;
  }

  const orderId = generateId("ord");
  const orderRef = generateOrderRef();
  const aiNotes = await generateOrderAiNotes(env, {
    name: parsed.name,
    delivery_type: parsed.delivery_type,
    notes: parsed.notes,
    itemSummary: parsed.items.map((i) => `${i.product_id} x${i.quantity}`).join(", ")
  });

  await env.DB.prepare(
    `INSERT INTO orders (
      id, order_ref, name, email, phone, notes, status, delivery_type, total_amount, ai_notes
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
  )
    .bind(orderId, orderRef, parsed.name, parsed.email, parsed.phone, parsed.notes ?? null, parsed.delivery_type, totalAmount, aiNotes)
    .run();

  for (const item of parsed.items) {
    const product = productMap.get(item.product_id)!;
    await env.DB.prepare(
      "INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(generateId("item"), orderId, item.product_id, item.quantity, product.price)
      .run();
  }

  const otp = await createOrderOtp(env, orderRef);
  await sendOrderOtpEmail(env, {
    to: parsed.email,
    customerName: parsed.name,
    orderRef,
    deliveryType: parsed.delivery_type,
    notes: parsed.notes,
    otp
  });

  return { order_ref: orderRef, status: "pending" };
}

export async function verifyOrder(request: Request, env: Env): Promise<{ order_ref: string; status: string }> {
  const body = await readJson<unknown>(request);
  const parsed = verifyOrderOtpSchema.parse(body);

  const order = await env.DB.prepare(
    "SELECT id, name, email, notes, delivery_type, status FROM orders WHERE order_ref = ?"
  )
    .bind(parsed.order_ref)
    .first<{ id: string; name: string; email: string; notes: string | null; delivery_type: "delivery" | "pickup"; status: string }>();

  if (!order) {
    throw new HttpError("Order not found", 404);
  }
  if (order.status !== "pending") {
    throw new HttpError(`Order already ${order.status}`, 400);
  }

  await verifyOrderOtp(env, parsed.order_ref, parsed.otp);
  await env.DB.prepare("UPDATE orders SET status = 'verified', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(order.id)
    .run();

  await sendOrderConfirmationEmail(env, {
    to: order.email,
    customerName: order.name,
    orderRef: parsed.order_ref,
    deliveryType: order.delivery_type,
    notes: order.notes
  });

  return { order_ref: parsed.order_ref, status: "verified" };
}

export async function resendOrderVerificationOtp(request: Request, env: Env): Promise<{ order_ref: string; resent: boolean }> {
  const body = await readJson<unknown>(request);
  const parsed = resendOrderOtpSchema.parse(body);

  const order = await env.DB.prepare(
    "SELECT name, email, notes, delivery_type, status FROM orders WHERE order_ref = ?"
  )
    .bind(parsed.order_ref)
    .first<{ name: string; email: string; notes: string | null; delivery_type: "delivery" | "pickup"; status: string }>();

  if (!order) {
    throw new HttpError("Order not found", 404);
  }
  if (order.status !== "pending") {
    throw new HttpError("OTP can only be resent while order is pending", 400);
  }

  const otp = await resendOrderOtp(env, parsed.order_ref);
  await sendOrderOtpEmail(env, {
    to: order.email,
    customerName: order.name,
    orderRef: parsed.order_ref,
    deliveryType: order.delivery_type,
    notes: order.notes,
    otp
  });
  return { order_ref: parsed.order_ref, resent: true };
}
