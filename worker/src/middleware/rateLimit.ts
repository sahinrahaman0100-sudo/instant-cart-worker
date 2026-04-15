import { Env } from "../types/env";
import { normalizeIp } from "../utils/order";
import { HttpError } from "../utils/errors";

const RATE_LIMIT = 60;
const WINDOW_SECONDS = 60;

type RateRecord = {
  count: number;
  resetAt: number;
};

export async function enforceRateLimit(request: Request, env: Env): Promise<void> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/admin")) {
    return;
  }

  const ip = normalizeIp(request);
  const route = `${request.method}:${url.pathname}`;
  const key = `rate:${ip}:${route}`;
  const now = Math.floor(Date.now() / 1000);

  const existing = await env.STORE_KV.get<RateRecord>(key, { type: "json" });
  if (!existing || now > existing.resetAt) {
    const fresh: RateRecord = { count: 1, resetAt: now + WINDOW_SECONDS };
    await env.STORE_KV.put(key, JSON.stringify(fresh), { expirationTtl: WINDOW_SECONDS + 5 });
    return;
  }

  if (existing.count >= RATE_LIMIT) {
    throw new HttpError("Rate limit exceeded", 429, {
      retry_after_seconds: Math.max(0, existing.resetAt - now)
    });
  }

  existing.count += 1;
  await env.STORE_KV.put(key, JSON.stringify(existing), {
    expirationTtl: Math.max(1, existing.resetAt - now + 5)
  });
}
