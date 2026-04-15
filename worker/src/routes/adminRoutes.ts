import { Env } from "../types/env";
import { HttpError } from "../utils/errors";
import { readJson, getBaseUrl } from "../utils/http";
import { adminRequestOtpSchema, adminVerifyOtpSchema, shippingSchema } from "../utils/validation";
import { createAdminOtp, createAdminSession, verifyAdminOtp } from "../services/otpService";
import { createPaymentLink } from "../services/razorpayService";
import { sendOrderOtpEmail, sendPaymentLinkEmail, sendRejectionEmail, sendShippingUpdateEmail } from "../services/emailService";

type OrderForAdmin = {
  id: string;
  order_ref: string;
  name: string;
  email: string;
  phone: string;
  notes: string | null;
  status: string;
  delivery_type: "delivery" | "pickup";
  total_amount: number;
};

async function getOrderById(env: Env, id: string): Promise<OrderForAdmin> {
  const order = await env.DB.prepare(
    "SELECT id, order_ref, name, email, phone, notes, status, delivery_type, total_amount FROM orders WHERE id = ?"
  )
    .bind(id)
    .first<OrderForAdmin>();
  if (!order) {
    throw new HttpError("Order not found", 404);
  }
  return order;
}

export async function requestAdminOtp(request: Request, env: Env): Promise<{ otp_sent: boolean }> {
  const body = await readJson<unknown>(request);
  const parsed = adminRequestOtpSchema.parse(body);
  if (parsed.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
    throw new HttpError("Unauthorized admin email", 401);
  }
  if (parsed.api_key !== env.ADMIN_API_KEY) {
    throw new HttpError("Invalid admin API key", 401);
  }

  const otp = await createAdminOtp(env, parsed.email);
  await sendOrderOtpEmail(env, {
    to: parsed.email,
    customerName: "Admin",
    orderRef: "ADMIN-LOGIN",
    deliveryType: "pickup",
    notes: "Admin login authentication",
    otp
  });

  return { otp_sent: true };
}

export async function verifyAdminLogin(request: Request, env: Env): Promise<{ token: string; expires_in_seconds: number }> {
  const body = await readJson<unknown>(request);
  const parsed = adminVerifyOtpSchema.parse(body);
  if (parsed.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
    throw new HttpError("Unauthorized admin email", 401);
  }
  if (parsed.api_key !== env.ADMIN_API_KEY) {
    throw new HttpError("Invalid admin API key", 401);
  }

  await verifyAdminOtp(env, parsed.email, parsed.otp);
  const token = await createAdminSession(env, parsed.email);
  return { token, expires_in_seconds: 86400 };
}

export async function acceptOrder(request: Request, env: Env, orderId: string): Promise<{ payment_link: string }> {
  const order = await getOrderById(env, orderId);
  if (order.status !== "verified") {
    throw new HttpError("Order must be verified before accepting", 400);
  }
  const callbackUrl = `${getBaseUrl(request)}/api/track/${order.order_ref}`;
  const payment = await createPaymentLink(env, {
    orderRef: order.order_ref,
    customerName: order.name,
    email: order.email,
    phone: order.phone,
    amount: order.total_amount,
    callbackUrl
  });
  await env.DB.prepare(
    "UPDATE orders SET status = 'accepted', payment_link = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  )
    .bind(payment.short_url, order.id)
    .run();

  await sendPaymentLinkEmail(env, {
    to: order.email,
    customerName: order.name,
    orderRef: order.order_ref,
    deliveryType: order.delivery_type,
    notes: order.notes,
    paymentLink: payment.short_url,
    amount: order.total_amount
  });

  return { payment_link: payment.short_url };
}

export async function rejectOrder(env: Env, orderId: string): Promise<{ status: string }> {
  const order = await getOrderById(env, orderId);
  if (["shipped", "delivered", "paid"].includes(order.status)) {
    throw new HttpError("Cannot reject an already processed order", 400);
  }

  await env.DB.prepare("UPDATE orders SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(order.id)
    .run();

  await sendRejectionEmail(env, {
    to: order.email,
    customerName: order.name,
    orderRef: order.order_ref,
    deliveryType: order.delivery_type,
    notes: order.notes
  });
  return { status: "rejected" };
}

export async function shipOrder(request: Request, env: Env, orderId: string): Promise<{ status: string }> {
  const body = await readJson<unknown>(request);
  const parsed = shippingSchema.parse(body);
  const order = await getOrderById(env, orderId);
  if (!["accepted", "paid"].includes(order.status)) {
    throw new HttpError("Order must be accepted or paid before shipping", 400);
  }
  await env.DB.prepare(
    "UPDATE orders SET status = 'shipped', shipping_info = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  )
    .bind(parsed.shipping_info, order.id)
    .run();

  await sendShippingUpdateEmail(env, {
    to: order.email,
    customerName: order.name,
    orderRef: order.order_ref,
    deliveryType: order.delivery_type,
    notes: order.notes,
    shippingInfo: parsed.shipping_info
  });
  return { status: "shipped" };
}

export async function deliverOrder(env: Env, orderId: string): Promise<{ status: string }> {
  const order = await getOrderById(env, orderId);
  if (order.status !== "shipped") {
    throw new HttpError("Only shipped orders can be marked delivered", 400);
  }
  await env.DB.prepare("UPDATE orders SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(order.id)
    .run();
  return { status: "delivered" };
}
