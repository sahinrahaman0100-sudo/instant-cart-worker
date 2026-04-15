export function generateOrderRef(): string {
  const randomPart = Math.floor(Math.random() * 90000) + 10000;
  return `ORD-${randomPart}`;
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function normalizeIp(request: Request): string {
  const headerIp = request.headers.get("cf-connecting-ip");
  if (headerIp && headerIp.trim()) {
    return headerIp.trim();
  }
  return "unknown";
}
