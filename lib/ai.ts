import type { SourceType } from "./hmrc-categories";
import { categoriesFor } from "./hmrc-categories";

// Real Claude categorisation. Activates automatically when ANTHROPIC_API_KEY is
// set; otherwise callers fall back to the deterministic mock categoriser.
// AI never produces a tax figure — only a category suggestion + confidence.

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export interface AiSuggestion { category: string; confidence: number; reason?: string }

export async function aiCategorise(
  description: string,
  sourceType: SourceType,
  direction: "income" | "expense",
): Promise<AiSuggestion | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const options = categoriesFor(sourceType).filter((c) => c.direction === direction);
  const list = options.map((c) => `${c.code} = ${c.label}`).join("\n");

  const prompt = `You categorise UK accounting transactions into HMRC MTD categories.

Allowed categories (${direction}):
${list}

Transaction description: "${description}"

Reply with ONLY compact JSON: {"category":"<code>","confidence":<0-1>,"reason":"<8 words max>"}
Use a confidence below 0.8 if genuinely ambiguous.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { content?: { text?: string }[] };
    const text = j.content?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as AiSuggestion;
    // Only trust a category that is actually in the allowed list.
    if (!options.some((c) => c.code === parsed.category)) return null;
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    return { category: parsed.category, confidence, reason: parsed.reason };
  } catch {
    return null; // never break the pipeline on an AI failure
  }
}
