import { Env } from "../types/env";

export async function generateOrderAiNotes(
  env: Env,
  input: {
    name: string;
    delivery_type: "delivery" | "pickup";
    notes?: string | null;
    itemSummary: string;
  }
): Promise<string | null> {
  if (!env.ANTHROPIC_API_KEY) {
    return null;
  }
  const prompt = [
    "Create one short operational note for order handling.",
    `Customer: ${input.name}`,
    `Delivery type: ${input.delivery_type}`,
    `Items: ${input.itemSummary}`,
    `Customer notes: ${input.notes ?? "none"}`
  ].join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 80,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return data.content?.find((chunk) => chunk.type === "text")?.text?.trim() ?? null;
}
