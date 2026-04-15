export type OrderStatus =
  | "pending"
  | "verified"
  | "accepted"
  | "paid"
  | "shipped"
  | "delivered"
  | "rejected";

export type DeliveryType = "delivery" | "pickup";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost_price: number;
  stock_qty: number;
  min_qty: number;
  max_daily_qty: number;
  supplier_info: string;
  active: number;
}

export interface Order {
  id: string;
  order_ref: string;
  name: string;
  email: string;
  phone: string;
  notes: string | null;
  status: OrderStatus;
  delivery_type: DeliveryType;
  total_amount: number;
  payment_link: string | null;
  payment_id: string | null;
  shipping_info: string | null;
  ai_notes: string | null;
  created_at: string;
}
