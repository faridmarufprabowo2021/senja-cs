import { PrismaClient } from "@prisma/client";
import { retrieveChunks } from "../src/bot/retrieve.js";

const p = new PrismaClient();

async function main() {
  const tenants = await p.tenant.findMany({
    take: 8,
    select: { id: true, name: true, slug: true },
  });
  for (const t of tenants) {
    const docs = await p.knowledgeDocument.count({
      where: { tenantId: t.id, status: "ready" },
    });
    const chunks = await p.knowledgeChunk.count({ where: { tenantId: t.id } });
    const settings = await p.botSettings.findUnique({
      where: { tenantId: t.id },
    });
    console.log(
      t.slug,
      "docs",
      docs,
      "chunks",
      chunks,
      "threshold",
      settings?.confidenceThreshold,
      "enabled",
      settings?.enabled,
    );
    if (chunks > 0) {
      const r = await retrieveChunks(t.id, "jam buka berapa?", 3);
      console.log(
        "  retrieve",
        r.map((x) => ({ title: x.title, score: Number(x.score.toFixed(3)) })),
      );
    }
  }
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
