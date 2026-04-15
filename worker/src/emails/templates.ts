type BaseEmailInput = {
  customerName: string;
  orderRef: string;
  deliveryType: "delivery" | "pickup";
  notes?: string | null;
};

function wrapTemplate(title: string, body: string, base: BaseEmailInput): string {
  const deliveryBadge = base.deliveryType === "delivery" ? "Delivery" : "Pickup";
  const safeNotes = base.notes?.trim() ? base.notes : "No additional notes.";
  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">${title}</h2>
      <p>Hello ${base.customerName},</p>
      ${body}
      <div style="margin-top: 16px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <p style="margin: 4px 0;"><strong>Order Ref:</strong> ${base.orderRef}</p>
        <p style="margin: 4px 0;"><strong>Delivery Type:</strong> <span style="background:#eef2ff; padding: 2px 8px; border-radius: 999px;">${deliveryBadge}</span></p>
        <p style="margin: 4px 0;"><strong>Notes:</strong> ${safeNotes}</p>
      </div>
      <p style="margin-top: 18px;">Thank you for choosing us.</p>
    </div>
  `;
}

export function otpEmailHtml(input: BaseEmailInput & { otp: string }): string {
  return wrapTemplate(
    "Verify your order",
    `<p>Your one-time password (OTP) is <strong style="font-size: 18px;">${input.otp}</strong>.</p>
     <p>This OTP expires in 10 minutes.</p>`,
    input
  );
}

export function paymentLinkEmailHtml(input: BaseEmailInput & { paymentLink: string; amount: number }): string {
  return wrapTemplate(
    "Complete payment for your order",
    `<p>Your order is accepted. Please complete payment of <strong>Rs. ${(input.amount / 100).toFixed(2)}</strong>.</p>
     <p><a href="${input.paymentLink}" style="display:inline-block;background:#2563eb;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;">Pay Now</a></p>
     <p>The link expires in 1 hour.</p>`,
    input
  );
}

export function orderConfirmationEmailHtml(input: BaseEmailInput): string {
  return wrapTemplate(
    "Order confirmed",
    "<p>Your order has been verified and is in processing queue.</p>",
    input
  );
}

export function shippingUpdateEmailHtml(input: BaseEmailInput & { shippingInfo: string }): string {
  return wrapTemplate(
    "Order shipped",
    `<p>Your order has been shipped.</p><p><strong>Shipping Info:</strong> ${input.shippingInfo}</p>`,
    input
  );
}

export function rejectionEmailHtml(input: BaseEmailInput): string {
  return wrapTemplate(
    "Order rejected",
    "<p>We are sorry, your order could not be fulfilled at this time. If needed, please place a new order.</p>",
    input
  );
}
