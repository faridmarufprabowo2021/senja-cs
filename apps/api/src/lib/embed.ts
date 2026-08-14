import { createHash } from "node:crypto";
import { env, hasRemoteEmbed } from "./env.js";

const DIM = 256;

/** Portable bag-of-words hash embedding (no API). Good enough for FAQ demo. */
export function localEmbed(text: string): number[] {
  const vec = new Array<number>(DIM).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (const t of tokens) {
    const h = createHash("sha256").update(t).digest();
    const idx = h.readUInt16BE(0) % DIM;
    const sign = h[2]! & 1 ? 1 : -1;
    vec[idx]! += sign;
  }
  return l2Normalize(vec);
}

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function l2Normalize(v: number[]) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

export async function embedText(text: string): Promise<number[]> {
  // Claude / OpenAgentic often has no embeddings endpoint — local is default.
  if (!hasRemoteEmbed) return localEmbed(text);

  try {
    const res = await fetch(`${env.LLM_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.LLM_EMBED_MODEL,
        input: text.slice(0, 8000),
      }),
    });
    if (!res.ok) {
      console.warn("embed API failed, fallback local", await res.text());
      return localEmbed(text);
    }
    const data = (await res.json()) as {
      data: { embedding: number[] }[];
    };
    return l2Normalize(data.data[0]?.embedding ?? localEmbed(text));
  } catch (err) {
    console.warn("embed error, fallback local", err);
    return localEmbed(text);
  }
}

export function asNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((x) => typeof x === "number")) return null;
  return value as number[];
}
