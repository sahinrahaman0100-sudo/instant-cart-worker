import { Env } from "../types/env";
import { generateId } from "../utils/order";
import { HttpError } from "../utils/errors";
import { productSchema } from "../utils/validation";
import { readJson } from "../utils/http";

export async function listCatalog(env: Env): Promise<unknown[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM products WHERE active = 1 ORDER BY category, name"
  ).all<unknown>();
  return results;
}

export async function getCatalogProduct(env: Env, id: string): Promise<unknown> {
  const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?")
    .bind(id)
    .first<unknown>();
  if (!product) {
    throw new HttpError("Product not found", 404);
  }
  return product;
}

export async function createProduct(request: Request, env: Env): Promise<{ id: string }> {
  const body = await readJson<unknown>(request);
  const parsed = productSchema.parse(body);
  const id = generateId("prd");
  await env.DB.prepare(
    `INSERT INTO products (
      id, name, sku, category, price, cost_price, stock_qty, min_qty, max_daily_qty, supplier_info, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      parsed.name,
      parsed.sku,
      parsed.category,
      parsed.price,
      parsed.cost_price,
      parsed.stock_qty,
      parsed.min_qty,
      parsed.max_daily_qty,
      parsed.supplier_info,
      parsed.active ? 1 : 0
    )
    .run();
  return { id };
}

export async function updateProduct(request: Request, env: Env, id: string): Promise<void> {
  const body = await readJson<unknown>(request);
  const parsed = productSchema.partial().refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required for update"
  }).parse(body);

  const current = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
  if (!current) {
    throw new HttpError("Product not found", 404);
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    updates.push(`${key} = ?`);
    values.push(key === "active" ? ((value as boolean) ? 1 : 0) : value);
  }
  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  await env.DB.prepare(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
}

export async function deleteProduct(env: Env, id: string): Promise<void> {
  const result = await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  if (!result.success || (result.meta.changes ?? 0) < 1) {
    throw new HttpError("Product not found", 404);
  }
}
