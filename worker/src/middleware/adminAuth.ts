import { Env } from "../types/env";
import { getAdminSession } from "../services/otpService";
import { HttpError } from "../utils/errors";

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) {
    return null;
  }
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

export async function requireAdminSession(request: Request, env: Env): Promise<{ email: string }> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new HttpError("Missing admin session token", 401);
  }
  const session = await getAdminSession(env, token);
  if (!session || session.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
    throw new HttpError("Invalid or expired admin session", 401);
  }
  return session;
}
import { Env } from "../types/env";
import { getAdminSession } from "../services/otpService";
import { HttpError } from "../utils/errors";

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) {
    return null;
  }
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

export async function requireAdminSession(request: Request, env: Env): Promise<{ email: string }> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new HttpError("Missing admin session token", 401);
  }
  const session = await getAdminSession(env, token);
  if (!session || session.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
    throw new HttpError("Invalid or expired admin session", 401);
  }
  return session;
}
