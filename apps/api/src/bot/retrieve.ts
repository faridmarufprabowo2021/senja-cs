import { prisma } from "../lib/prisma.js";
import { asNumberArray, cosine, embedText } from "../lib/embed.js";

export type RetrievedChunk = {
  id: string;
  documentId?: string;
  fileUrl?: string;
  content: string;
  title: string;
  score: number;
};

const STOP = new Set([
  "yang",
  "dan",
  "atau",
  "untuk",
  "dari",
  "dengan",
  "ini",
  "itu",
  "ada",
  "apa",
  "kah",
  "ya",
  "dong",
  "sih",
  "kak",
  "min",
  "tolong",
  "mohon",
  "bisa",
  "mau",
  "ingin",
  "saya",
  "kami",
  "kamu",
  "anda",
  "the",
  "a",
  "is",
  "of",
  "to",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Keyword overlap 0..1 — helps short FAQ queries where hash-embed is weak. */
function keywordScore(query: string, content: string, title: string): number {
  const q = tokens(query);
  if (!q.length) return 0;
  const hay = `${title} ${content}`.toLowerCase();
  let hit = 0;
  let weight = 0;
  for (const t of q) {
    const w = t.length >= 5 ? 2 : 1;
    weight += w;
    if (hay.includes(t)) hit += w;
  }
  return weight ? hit / weight : 0;
}

export async function retrieveChunks(
  tenantId: string,
  query: string,
  topK = 5,
): Promise<RetrievedChunk[]> {
  const queryVec = await embedText(query);

  // 1. Try super-fast PostgreSQL pgvector HNSW search (< 15ms)
  try {
    const vectorStr = `[${queryVec.join(",")}]`;
    const rawResults = await prisma.$queryRawUnsafe<
      Array<{ id: string; documentId: string; fileUrl: string | null; content: string; title: string; vec_score: number }>
    >(`
      SELECT 
        kc.id,
        kc."documentId",
        kd."fileUrl",
        kc.content,
        kd.title,
        (1 - (kc.embedding_vector <=> '${vectorStr}'::vector)) AS vec_score
      FROM "KnowledgeChunk" kc
      JOIN "KnowledgeDocument" kd ON kc."documentId" = kd.id
      WHERE kc."tenantId" = '${tenantId}'
        AND kd.status = 'ready'
        AND kc.embedding_vector IS NOT NULL
      ORDER BY kc.embedding_vector <=> '${vectorStr}'::vector
      LIMIT 20;
    `);

    if (rawResults && rawResults.length > 0) {
      const scored: RetrievedChunk[] = rawResults.map((r) => {
        const kw = keywordScore(query, r.content, r.title);
        const vec = Number(r.vec_score) || 0;
        const score = Math.min(
          1,
          vec * 0.4 + kw * 0.7 + (kw > 0 && vec > 0 ? 0.08 : 0),
        );
        return {
          id: r.id,
          documentId: r.documentId,
          fileUrl: r.fileUrl ?? undefined,
          content: r.content,
          title: r.title,
          score,
        };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK);
    }
  } catch (pgVecErr) {
    /* Fallback to Prisma in-memory search */
  }

  // 2. Fallback: Prisma in-memory hybrid search
  const rows = await prisma.knowledgeChunk.findMany({
    where: {
      tenantId,
      document: { status: "ready" },
    },
    include: { document: { select: { id: true, title: true, fileUrl: true } } },
    take: 400,
  });

  if (!rows.length) return [];

  const scored: RetrievedChunk[] = [];
  for (const row of rows) {
    const emb = asNumberArray(row.embedding);
    const vec = emb ? cosine(queryVec, emb) : 0;
    const kw = keywordScore(query, row.content, row.document.title);
    // hybrid: keyword heavier for short chat FAQ; vector helps paraphrases
    const score = Math.min(
      1,
      vec * 0.4 + kw * 0.7 + (kw > 0 && vec > 0 ? 0.08 : 0),
    );
    scored.push({
      id: row.id,
      documentId: row.document.id,
      fileUrl: row.document.fileUrl ?? undefined,
      content: row.content,
      title: row.document.title,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  // Keep topK; if all scores ~0 still return best chunks so LLM/extractive have context
  const top = scored.slice(0, topK);
  if (top.every((c) => c.score < 0.02) && scored.length) {
    return scored.slice(0, Math.min(topK, 3)).map((c) => ({
      ...c,
      score: Math.max(c.score, 0.05),
    }));
  }
  return top;
}
