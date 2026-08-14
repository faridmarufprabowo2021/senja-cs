import { prisma } from "../lib/prisma.js";
import { chunkText, estimateTokens } from "../lib/chunk.js";
import { embedText } from "../lib/embed.js";

export async function extractCatalogFromContent(tenantId: string, content: string) {
  const lines = content.split("\n");
  const extractedProducts: { name: string; price: number; description?: string }[] = [];

  for (const line of lines) {
    // Match markdown table row like: | Layanan | Rp 150.000 | or | Nama | 150.000 – 300.000 |
    const tableMatch = line.match(/^\|?\s*([^|]+?)\s*\|\s*(?:Rp|IDR)?\s*([\d.,\s–-]+)\s*\|?/i);
    if (tableMatch) {
      const rawName = tableMatch[1].trim().replace(/^[-*•]\s*/, "");
      const rawPrice = tableMatch[2].trim();

      // Extract first number sequence as price
      const priceNumMatch = rawPrice.replace(/\./g, "").match(/\d+/);
      if (priceNumMatch && rawName && !/layanan|estimasi|harga|nama|tindakan|hari|jam|dokter|prosedur|metode|faq|asuransi|kebijakan|profil|kontak/i.test(rawName)) {
        const price = parseInt(priceNumMatch[0], 10);
        if (price >= 1000 && rawName.length >= 3 && rawName.length <= 100) {
          extractedProducts.push({
            name: rawName,
            price,
            description: `Auto-extracted dari Knowledge Base`,
          });
        }
      }
    }

    // Match list line like: - Tambal gigi komposit: Rp 200.000
    const listMatch = line.match(/^[-*•]\s*([^:]+?):\s*(?:Rp|IDR)?\s*([\d.,\s–-]+)/i);
    if (listMatch) {
      const rawName = listMatch[1].trim();
      const rawPrice = listMatch[2].trim();
      const priceNumMatch = rawPrice.replace(/\./g, "").match(/\d+/);
      if (priceNumMatch && rawName && !/layanan|estimasi|harga|nama/i.test(rawName)) {
        const price = parseInt(priceNumMatch[0], 10);
        if (price >= 1000 && rawName.length >= 3 && rawName.length <= 100) {
          extractedProducts.push({
            name: rawName,
            price,
            description: `Auto-extracted dari Knowledge Base`,
          });
        }
      }
    }
  }

  let count = 0;
  for (const p of extractedProducts) {
    const existing = await prisma.product.findFirst({
      where: { tenantId, name: { equals: p.name, mode: "insensitive" } },
    });
    if (!existing) {
      await prisma.product.create({
        data: {
          tenantId,
          name: p.name,
          price: p.price,
          description: p.description || "",
        },
      });
      count++;
    } else {
      await prisma.product.update({
        where: { id: existing.id },
        data: { price: p.price },
      });
      count++;
    }
  }

  return count;
}

export async function ingestDocument(documentId: string, content: string) {
  const doc = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc) throw new Error("Document not found");

  try {
    await prisma.knowledgeChunk.deleteMany({ where: { documentId } });

    const parts = chunkText(content);
    if (parts.length === 0) {
      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: "failed",
          error: "Konten kosong",
          chunkCount: 0,
        },
      });
      return;
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const embedding = await embedText(part);
      const createdChunk = await prisma.knowledgeChunk.create({
        data: {
          tenantId: doc.tenantId,
          documentId,
          content: part,
          tokenCount: estimateTokens(part),
          embedding,
          metadata: { index: i, title: doc.title },
        },
      });

      // Sync pgvector column
      try {
        const vectorStr = `[${embedding.join(",")}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE "KnowledgeChunk" SET embedding_vector = '${vectorStr}'::vector WHERE id = '${createdChunk.id}'`
        );
      } catch (pgVecErr) {
        /* ignore if pgvector unavailable */
      }
    }

    // Auto extract catalog items into Product database table
    await extractCatalogFromContent(doc.tenantId, content).catch((err) => {
      console.warn("[ingest] catalog extraction warning", err);
    });

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: "ready",
        error: null,
        chunkCount: parts.length,
      },
    });
  } catch (err) {
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: "failed",
        error: err instanceof Error ? err.message : "Ingest failed",
      },
    });
    throw err;
  }
}

export async function reindexDocument(documentId: string) {
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
  });
  if (chunks.length === 0) {
    throw new Error("Tidak ada chunk — upload ulang konten");
  }
  await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: { status: "processing", error: null },
  });
  const content = chunks.map((c) => c.content).join("\n\n");
  await ingestDocument(documentId, content);
}
