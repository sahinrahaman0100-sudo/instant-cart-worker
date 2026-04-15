import { Env } from "../types/env";
import { verifyRazorpayWebhookSignature } from "../services/razorpayService";
import { HttpError } from "../utils/errors";

type RazorpayWebhookPayload = {
  event: string;
  payload?: {
    payment_link?: {
      entity?: {
        reference_id?: string;
      };
    };
    payment?: {
      entity?: {
        id?: string;
      };
    };
  };
};

export async function handleRazorpayWebhook(request: Request, env: Env): Promise<{ processed: boolean }> {
  const rawBody = await request.text();
  await verifyRazorpayWebhookSignature(env, rawBody, request.headers.get("x-razorpay-signature"));

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    throw new HttpError("Invalid webhook payload", 400);
  }

  if (payload.event !== "payment_link.paid") {
    return { processed: true };
  }

  const orderRef = payload.payload?.payment_link?.entity?.reference_id;
  const paymentId = payload.payload?.payment?.entity?.id;

  if (!orderRef || !paymentId) {
    throw new HttpError("Missing payment reference in webhook", 400);
  }

  await env.DB.prepare(
    "UPDATE orders SET status = 'paid', payment_id = ?, updated_at = CURRENT_TIMESTAMP WHERE order_ref = ?"
  )
    .bind(paymentId, orderRef)
    .run();

  return { processed: true };
}
