import { Env } from "../types/env";
import { HttpError } from "../utils/errors";

const ORDER_TIMELINE: Array<"pending" | "verified" | "accepted" | "paid" | "shipped" | "delivered"> = [
  "pending",
  "verified",
  "accepted",
  "paid",
  "shipped",
  "delivered"
];

export async function trackOrder(env: Env, orderRef: string): Promise<unknown> {
  const order = await env.DB.prepare(
    "SELECT order_ref, status, delivery_type, total_amount, payment_link, payment_id, shipping_info, notes, created_at FROM orders WHERE order_ref = ?"
  )
    .bind(orderRef)
    .first<{
      order_ref: string;
      status: string;
      delivery_type: "delivery" | "pickup";
      total_amount: number;
      payment_link: string | null;
      payment_id: string | null;
      shipping_info: string | null;
      notes: string | null;
      created_at: string;
    }>();
  if (!order) {
    throw new HttpError("Order not found", 404);
  }

  const currentIndex = ORDER_TIMELINE.indexOf(order.status as (typeof ORDER_TIMELINE)[number]);
  const timeline = ORDER_TIMELINE.map((step, idx) => ({
    status: step,
    reached: currentIndex >= idx,
    at: currentIndex >= idx ? order.created_at : null
  }));

  if (order.status === "rejected") {
    timeline.push({
      status: "rejected",
      reached: true,
      at: order.created_at
    });
  }

  const { results: items } = await env.DB.prepare(
    `SELECT oi.product_id, p.name AS product_name, oi.quantity, oi.price
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN orders o ON o.id = oi.order_id
     WHERE o.order_ref = ?`
  )
    .bind(orderRef)
    .all();

  return {
    ...order,
    timeline,
    items
  };
}
