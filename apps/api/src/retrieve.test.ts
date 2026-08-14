/**
 * RAG — retrieveChunks ranking tests
 * Run: pnpm --filter @cs/api test:retrieve
 * Requires Postgres (DATABASE_URL). Creates ephemeral tenants, cleans up.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./lib/prisma.js";
import { embedText } from "./lib/embed.js";
import { retrieveChunks } from "./bot/retrieve.js";

const stamp = Date.now().toString(36);
const ids = { tenantA: "", tenantB: "" };

after(async () => {
  try {
    if (ids.tenantA) {
      await prisma.tenant.delete({ where: { id: ids.tenantA } }).catch(() => undefined);
    }
    if (ids.tenantB) {
      await prisma.tenant.delete({ where: { id: ids.tenantB } }).catch(() => undefined);
    }
  } finally {
    await prisma.$disconnect();
  }
});

const tenantA = await prisma.tenant.create({
  data: { name: `RAG A ${stamp}`, slug: `rag-a-${stamp}`, botSettings: { create: {} } },
});
ids.tenantA = tenantA.id;

const tenantB = await prisma.tenant.create({
  data: { name: `RAG B ${stamp}`, slug: `rag-b-${stamp}`, botSettings: { create: {} } },
});
ids.tenantB = tenantB.id;

async function addChunk(
  tenantId: string,
  documentId: string,
  content: string,
) {
  return prisma.knowledgeChunk.create({
    data: {
      tenantId,
      documentId,
      content,
      tokenCount: content.split(/\s+/).length,
      embedding: await embedText(content),
    },
  });
}

// Tenant A: satu dokumen ready berisi 2 topik berbeda
const docReady = await prisma.knowledgeDocument.create({
  data: { tenantId: tenantA.id, title: "FAQ Toko Kopi", sourceType: "txt", status: "ready" },
});
const chunkKopi = await addChunk(
  tenantA.id,
  docReady.id,
  "Harga kopi susu gula aren Rp18.000 per cup. Tersedia ukuran large Rp22.000.",
);
await addChunk(
  tenantA.id,
  docReady.id,
  "Jam operasional toko: Senin sampai Jumat pukul 08.00-17.00 WIB.",
);

// Dokumen draft — chunk-nya TIDAK boleh ikut ter-retrieve
const docDraft = await prisma.knowledgeDocument.create({
  data: { tenantId: tenantA.id, title: "Draft Promo", sourceType: "txt", status: "processing" },
});
await addChunk(
  tenantA.id,
  docDraft.id,
  "Promo kopi susu beli 2 gratis 1 berlaku akhir bulan.",
);

// Tenant B: chunk dengan kata kunci sama — tidak boleh bocor ke tenant A
const docB = await prisma.knowledgeDocument.create({
  data: { tenantId: tenantB.id, title: "FAQ B", sourceType: "txt", status: "ready" },
});
await addChunk(
  tenantB.id,
  docB.id,
  "Harga kopi susu di tenant B adalah Rp99.000.",
);

test("query harga kopi → chunk kopi tenant A ranked pertama", async () => {
  const chunks = await retrieveChunks(tenantA.id, "berapa harga kopi susu?", 5);
  assert.ok(chunks.length > 0);
  assert.equal(chunks[0].id, chunkKopi.id);
  assert.equal(chunks[0].title, "FAQ Toko Kopi");
  assert.ok(chunks[0].score > 0);
});

test("chunk dari dokumen non-ready tidak ikut ter-retrieve", async () => {
  const chunks = await retrieveChunks(tenantA.id, "promo kopi susu beli 2 gratis 1", 5);
  assert.ok(!chunks.some((c) => c.title === "Draft Promo"));
});

test("isolasi tenant: chunk tenant B tidak bocor ke tenant A", async () => {
  const chunks = await retrieveChunks(tenantA.id, "harga kopi susu", 10);
  assert.ok(!chunks.some((c) => c.content.includes("tenant B")));
});

test("topK dihormati", async () => {
  const chunks = await retrieveChunks(tenantA.id, "kopi", 1);
  assert.ok(chunks.length <= 1);
});
