export interface Env {
  DB: D1Database;
  STORE_KV: KVNamespace;
  RESEND_API_KEY: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}
