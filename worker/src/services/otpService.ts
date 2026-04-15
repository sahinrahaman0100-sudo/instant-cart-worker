import { Env } from "../types/env";
import { HttpError } from "../utils/errors";

const ORDER_OTP_TTL_SECONDS = 10 * 60;
const ADMIN_OTP_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_RESENDS = 3;
const RESEND_COOLDOWN_SECONDS = 60;

type OtpRecord = {
  otp: string;
  attempts: number;
  resend_count: number;
  cooldown_until: number;
};

function generateOtp(): string {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

async function getJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  return kv.get<T>(key, { type: "json" });
}

export async function createOrderOtp(env: Env, orderRef: string): Promise<string> {
  const otp = generateOtp();
  const key = `otp:${orderRef}`;
  const data: OtpRecord = {
    otp,
    attempts: 0,
    resend_count: 0,
    cooldown_until: Math.floor(Date.now() / 1000) + RESEND_COOLDOWN_SECONDS
  };
  await env.STORE_KV.put(key, JSON.stringify(data), { expirationTtl: ORDER_OTP_TTL_SECONDS });
  return otp;
}

export async function verifyOrderOtp(env: Env, orderRef: string, otp: string): Promise<void> {
  const key = `otp:${orderRef}`;
  const record = await getJson<OtpRecord>(env.STORE_KV, key);
  if (!record) {
    throw new HttpError("OTP expired or invalid", 400);
  }
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new HttpError("Maximum OTP verification attempts reached", 429);
  }

  if (record.otp !== otp) {
    const updated = { ...record, attempts: record.attempts + 1 };
    await env.STORE_KV.put(key, JSON.stringify(updated), { expirationTtl: ORDER_OTP_TTL_SECONDS });
    throw new HttpError("Invalid OTP", 400);
  }

  await env.STORE_KV.delete(key);
}

export async function resendOrderOtp(env: Env, orderRef: string): Promise<string> {
  const key = `otp:${orderRef}`;
  const record = await getJson<OtpRecord>(env.STORE_KV, key);
  if (!record) {
    throw new HttpError("OTP expired. Please create order again", 400);
  }

  const now = Math.floor(Date.now() / 1000);
  if (record.resend_count >= MAX_RESENDS) {
    throw new HttpError("Maximum OTP resend limit reached", 429);
  }
  if (now < record.cooldown_until) {
    throw new HttpError("OTP resend cooldown active", 429, {
      retry_after_seconds: record.cooldown_until - now
    });
  }

  const newOtp = generateOtp();
  const updated: OtpRecord = {
    otp: newOtp,
    attempts: 0,
    resend_count: record.resend_count + 1,
    cooldown_until: now + RESEND_COOLDOWN_SECONDS
  };
  await env.STORE_KV.put(key, JSON.stringify(updated), { expirationTtl: ORDER_OTP_TTL_SECONDS });
  return newOtp;
}

export async function createAdminOtp(env: Env, email: string): Promise<string> {
  const otp = generateOtp();
  const key = `admin_otp:${email.toLowerCase()}`;
  await env.STORE_KV.put(
    key,
    JSON.stringify({ otp, attempts: 0 }),
    { expirationTtl: ADMIN_OTP_TTL_SECONDS }
  );
  return otp;
}

export async function verifyAdminOtp(env: Env, email: string, otp: string): Promise<void> {
  const key = `admin_otp:${email.toLowerCase()}`;
  const record = await getJson<{ otp: string; attempts: number }>(env.STORE_KV, key);
  if (!record) {
    throw new HttpError("Admin OTP expired", 400);
  }
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new HttpError("Maximum admin OTP attempts reached", 429);
  }
  if (record.otp !== otp) {
    await env.STORE_KV.put(
      key,
      JSON.stringify({ otp: record.otp, attempts: record.attempts + 1 }),
      { expirationTtl: ADMIN_OTP_TTL_SECONDS }
    );
    throw new HttpError("Invalid admin OTP", 401);
  }

  await env.STORE_KV.delete(key);
}

export async function createAdminSession(env: Env, email: string): Promise<string> {
  const token = crypto.randomUUID();
  await env.STORE_KV.put(`session:${token}`, JSON.stringify({ email }), {
    expirationTtl: SESSION_TTL_SECONDS
  });
  return token;
}

export async function getAdminSession(env: Env, token: string): Promise<{ email: string } | null> {
  return getJson<{ email: string }>(env.STORE_KV, `session:${token}`);
}
