import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const rows = await p.botSettings.findMany({
    include: { tenant: { select: { slug: true } } },
  });
  for (const r of rows) {
    console.log("before", r.tenant.slug, r.model, "enabled", r.enabled);
  }
  const updated = await p.botSettings.updateMany({
    where: {
      OR: [
        { model: "gpt-4o-mini" },
        { model: { contains: "gpt-4o" } },
        { model: "" },
      ],
    },
    data: { model: "claude-sonnet-4.5" },
  });
  console.log("updated rows", updated.count);
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
