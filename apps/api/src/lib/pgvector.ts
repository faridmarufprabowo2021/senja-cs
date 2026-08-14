import { prisma } from "./prisma.js";

let isPgVectorInitialized = false;

/**
 * Ensures pgvector extension, vector column, and HNSW index exist in PostgreSQL database.
 */
export async function ensurePgVectorSetup(): Promise<boolean> {
  if (isPgVectorInitialized) return true;
  try {
    // 1. Enable pgvector extension
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // 2. Add embedding_vector column if missing
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "KnowledgeChunk" 
      ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);
    `);

    // 3. Create HNSW index for ultra-fast cosine similarity search
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "knowledge_chunk_vector_hnsw_idx" 
      ON "KnowledgeChunk" 
      USING hnsw (embedding_vector vector_cosine_ops);
    `);

    isPgVectorInitialized = true;
    console.log("[pgvector] Extension & HNSW index ready.");
    return true;
  } catch (err) {
    console.warn("[pgvector] Setup fallback notice:", err instanceof Error ? err.message : err);
    return false;
  }
}
