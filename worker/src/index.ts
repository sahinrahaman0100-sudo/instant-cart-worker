import { ZodError } from "zod";
import { Env } from "./types/env";
import { HttpError } from "./utils/errors";
import { errorResponse, ok } from "./utils/response";
import { enforceRateLimit } from "./middleware/rateLimit";
import { requireAdminSession } from "./middleware/adminAuth";
import { createProduct, deleteProduct, getCatalogProduct, listCatalog, updateProduct } from "./routes/catalogRoutes";
import { createOrder, resendOrderVerificationOtp, verifyOrder } from "./routes/orderRoutes";
import { acceptOrder, deliverOrder, rejectOrder, requestAdminOtp, shipOrder, verifyAdminLogin } from "./routes/adminRoutes";
import { handleRazorpayWebhook } from "./routes/webhookRoutes";
import { trackOrder } from "./routes/trackingRoutes";

function matchPath(pattern: RegExp, path: string): RegExpMatchArray | null {
  return path.match(pattern);
}

function isAdminProtectedRoute(path: string): boolean {
  if (!path.startsWith("/api/admin")) {
    return false;
  }
  return ![
    "/api/admin/auth/request-otp",
    "/api/admin/auth/verify-otp"
  ].includes(path);
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  await enforceRateLimit(request, env);
  if (isAdminProtectedRoute(pathname)) {
    await requireAdminSession(request, env);
  }

  if (request.method === "GET" && pathname === "/api/catalog") {
    return ok(await listCatalog(env));
  }
  const catalogIdMatch = matchPath(/^\/api\/catalog\/([^/]+)$/, pathname);
  if (request.method === "GET" && catalogIdMatch) {
    return ok(await getCatalogProduct(env, catalogIdMatch[1]));
  }

  if (request.method === "POST" && pathname === "/api/admin/products") {
    return ok(await createProduct(request, env), 201);
  }
  const adminProductIdMatch = matchPath(/^\/api\/admin\/products\/([^/]+)$/, pathname);
  if (request.method === "PUT" && adminProductIdMatch) {
    await updateProduct(request, env, adminProductIdMatch[1]);
    return ok({ updated: true });
  }
  if (request.method === "DELETE" && adminProductIdMatch) {
    await deleteProduct(env, adminProductIdMatch[1]);
    return ok({ deleted: true });
  }

  if (request.method === "POST" && pathname === "/api/order") {
    return ok(await createOrder(request, env), 201);
  }
  if (request.method === "POST" && pathname === "/api/order/verify") {
    return ok(await verifyOrder(request, env));
  }
  if (request.method === "POST" && pathname === "/api/order/resend-otp") {
    return ok(await resendOrderVerificationOtp(request, env));
  }

  if (request.method === "POST" && pathname === "/api/admin/auth/request-otp") {
    return ok(await requestAdminOtp(request, env));
  }
  if (request.method === "POST" && pathname === "/api/admin/auth/verify-otp") {
    return ok(await verifyAdminLogin(request, env));
  }

  const acceptMatch = matchPath(/^\/api\/admin\/orders\/([^/]+)\/accept$/, pathname);
  if (request.method === "POST" && acceptMatch) {
    return ok(await acceptOrder(request, env, acceptMatch[1]));
  }
  const rejectMatch = matchPath(/^\/api\/admin\/orders\/([^/]+)\/reject$/, pathname);
  if (request.method === "POST" && rejectMatch) {
    return ok(await rejectOrder(env, rejectMatch[1]));
  }
  const shipMatch = matchPath(/^\/api\/admin\/orders\/([^/]+)\/ship$/, pathname);
  if (request.method === "POST" && shipMatch) {
    return ok(await shipOrder(request, env, shipMatch[1]));
  }
  const deliverMatch = matchPath(/^\/api\/admin\/orders\/([^/]+)\/deliver$/, pathname);
  if (request.method === "POST" && deliverMatch) {
    return ok(await deliverOrder(env, deliverMatch[1]));
  }

  if (request.method === "POST" && pathname === "/api/webhook/razorpay") {
    return ok(await handleRazorpayWebhook(request, env));
  }

  const trackMatch = matchPath(/^\/api\/track\/(ORD-\d{5})$/, pathname);
  if (request.method === "GET" && trackMatch) {
    return ok(await trackOrder(env, trackMatch[1]));
  }

  return errorResponse("Route not found", 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      if (error instanceof HttpError) {
        return errorResponse(error.message, error.status, error.details);
      }
      if (error instanceof ZodError) {
        return errorResponse("Validation failed", 400, error.flatten());
      }
      return errorResponse("Internal server error", 500);
    }
  }
};
