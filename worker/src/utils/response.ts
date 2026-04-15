export function jsonResponse(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export function errorResponse(message: string, status = 400, details?: unknown): Response {
  return jsonResponse(
    {
      success: false,
      error: {
        message,
        ...(details !== undefined ? { details } : {})
      }
    },
    status
  );
}

export function ok(data: unknown, status = 200): Response {
  return jsonResponse({ success: true, data }, status);
}
