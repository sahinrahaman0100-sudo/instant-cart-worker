import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(2).max(120),
  sku: z.string().min(3).max(40),
  category: z.string().min(2).max(60),
  price: z.number().int().nonnegative(),
  cost_price: z.number().int().nonnegative(),
  stock_qty: z.number().int().nonnegative(),
  min_qty: z.number().int().positive(),
  max_daily_qty: z.number().int().positive(),
  supplier_info: z.string().min(3).max(300),
  active: z.boolean().default(true)
});

export const orderSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  notes: z.string().max(800).optional(),
  delivery_type: z.enum(["delivery", "pickup"]),
  items: z.array(
    z.object({
      product_id: z.string().min(1),
      quantity: z.number().int().positive()
    })
  ).min(1).max(50)
});

export const verifyOrderOtpSchema = z.object({
  order_ref: z.string().regex(/^ORD-\d{5}$/),
  otp: z.string().regex(/^\d{6}$/)
});

export const resendOrderOtpSchema = z.object({
  order_ref: z.string().regex(/^ORD-\d{5}$/)
});

export const adminRequestOtpSchema = z.object({
  email: z.string().email(),
  api_key: z.string().min(8)
});

export const adminVerifyOtpSchema = z.object({
  email: z.string().email(),
  api_key: z.string().min(8),
  otp: z.string().regex(/^\d{6}$/)
});

export const shippingSchema = z.object({
  shipping_info: z.string().min(3).max(1000)
});
