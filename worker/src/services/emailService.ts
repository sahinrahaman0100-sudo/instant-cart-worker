import { Env } from "../types/env";
import {
  otpEmailHtml,
  orderConfirmationEmailHtml,
  paymentLinkEmailHtml,
  rejectionEmailHtml,
  shippingUpdateEmailHtml
} from "../emails/templates";
import { HttpError } from "../utils/errors";

type BaseOrderEmail = {
  to: string;
  customerName: string;
  orderRef: string;
  deliveryType: "delivery" | "pickup";
  notes?: string | null;
};

async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Store Orders <onboarding@resend.dev>",
      to: [to],
      subject,
      html
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new HttpError("Email dispatch failed", 502, text);
  }
}

export async function sendOrderOtpEmail(
  env: Env,
  payload: BaseOrderEmail & { otp: string }
): Promise<void> {
  const html = otpEmailHtml({
    customerName: payload.customerName,
    orderRef: payload.orderRef,
    deliveryType: payload.deliveryType,
    notes: payload.notes,
    otp: payload.otp
  });
  await sendEmail(env, payload.to, `OTP for order ${payload.orderRef}`, html);
}

export async function sendOrderConfirmationEmail(env: Env, payload: BaseOrderEmail): Promise<void> {
  const html = orderConfirmationEmailHtml({
    customerName: payload.customerName,
    orderRef: payload.orderRef,
    deliveryType: payload.deliveryType,
    notes: payload.notes
  });
  await sendEmail(env, payload.to, `Order verified: ${payload.orderRef}`, html);
}

export async function sendPaymentLinkEmail(
  env: Env,
  payload: BaseOrderEmail & { paymentLink: string; amount: number }
): Promise<void> {
  const html = paymentLinkEmailHtml({
    customerName: payload.customerName,
    orderRef: payload.orderRef,
    deliveryType: payload.deliveryType,
    notes: payload.notes,
    paymentLink: payload.paymentLink,
    amount: payload.amount
  });
  await sendEmail(env, payload.to, `Payment required: ${payload.orderRef}`, html);
}

export async function sendShippingUpdateEmail(
  env: Env,
  payload: BaseOrderEmail & { shippingInfo: string }
): Promise<void> {
  const html = shippingUpdateEmailHtml({
    customerName: payload.customerName,
    orderRef: payload.orderRef,
    deliveryType: payload.deliveryType,
    notes: payload.notes,
    shippingInfo: payload.shippingInfo
  });
  await sendEmail(env, payload.to, `Order shipped: ${payload.orderRef}`, html);
}

export async function sendRejectionEmail(env: Env, payload: BaseOrderEmail): Promise<void> {
  const html = rejectionEmailHtml({
    customerName: payload.customerName,
    orderRef: payload.orderRef,
    deliveryType: payload.deliveryType,
    notes: payload.notes
  });
  await sendEmail(env, payload.to, `Order update: ${payload.orderRef}`, html);
}
