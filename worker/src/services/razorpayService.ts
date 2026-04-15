import { Env } from "../types/env";
import { hmacSha256Hex, timingSafeEqual } from "../utils/crypto";
import { HttpError } from "../utils/errors";

function basicAuthHeader(keyId: string, keySecret: string): string {
  const token = btoa(`${keyId}:${keySecret}`);
  return `Basic ${token}`;
}

export async function createPaymentLink(
  env: Env,
  payload: {
    orderRef: string;
    customerName: string;
    email: string;
    phone: string;
    amount: number;
    callbackUrl: string;
  }
): Promise<{ id: string; short_url: string }> {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: payload.amount,
      currency: "INR",
      expire_by: expiresAt,
      reference_id: payload.orderRef,
      description: `Payment for ${payload.orderRef}`,
      customer: {
        name: payload.customerName,
        email: payload.email,
        contact: payload.phone
      },
      notify: { sms: true, email: true },
      reminder_enable: true,
      callback_url: payload.callbackUrl,
      callback_method: "get"
    })
  });

  if (!response.ok) {
    throw new HttpError("Failed to create Razorpay payment link", 502, await response.text());
  }
  const json = (await response.json()) as { id: string; short_url: string };
  return json;
}

export async function verifyRazorpayWebhookSignature(
  env: Env,
  rawBody: string,
  signatureHeader: string | null
): Promise<void> {
  if (!signatureHeader) {
    throw new HttpError("Missing Razorpay signature header", 401);
  }
  const expected = await hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, rawBody);
  if (!timingSafeEqual(expected, signatureHeader)) {
    throw new HttpError("Invalid Razorpay webhook signature", 401);
  }
}
