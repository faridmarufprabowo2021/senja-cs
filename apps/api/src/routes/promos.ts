import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, requireTenant } from "../lib/auth.js";

export async function promoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  // List Promos
  app.get("/promos", async (request) => {
    const list = await prisma.promoVoucher.findMany({
      where: { tenantId: request.tenant.tenantId },
      orderBy: { createdAt: "desc" },
    });
    return list;
  });

  // Create Promo (Admin/Owner)
  app.post(
    "/promos",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const body = z
        .object({
          code: z.string().min(1).max(50),
          title: z.string().min(1).max(150),
          description: z.string().max(500).optional().default(""),
          discountAmount: z.number().int().min(0).optional().default(0),
          discountPercent: z.number().int().min(0).max(100).optional().default(0),
          minSpend: z.number().int().min(0).optional().default(0),
          validUntil: z.string().max(100).optional().default("Berlaku Setiap Saat"),
          active: z.boolean().optional().default(true),
        })
        .parse(request.body);

      const created = await prisma.promoVoucher.create({
        data: {
          tenantId: request.tenant.tenantId,
          code: body.code.toUpperCase().trim(),
          title: body.title.trim(),
          description: body.description.trim(),
          discountAmount: body.discountAmount,
          discountPercent: body.discountPercent,
          minSpend: body.minSpend,
          validUntil: body.validUntil,
          active: body.active,
        },
      });

      return reply.status(201).send(created);
    },
  );

  // Update Promo
  app.patch(
    "/promos/:id",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          code: z.string().min(1).max(50).optional(),
          title: z.string().min(1).max(150).optional(),
          description: z.string().max(500).optional(),
          discountAmount: z.number().int().min(0).optional(),
          discountPercent: z.number().int().min(0).max(100).optional(),
          minSpend: z.number().int().min(0).optional(),
          validUntil: z.string().max(100).optional(),
          active: z.boolean().optional(),
        })
        .parse(request.body);

      const updated = await prisma.promoVoucher.updateMany({
        where: { id, tenantId: request.tenant.tenantId },
        data: {
          ...(body.code ? { code: body.code.toUpperCase().trim() } : {}),
          ...(body.title ? { title: body.title.trim() } : {}),
          ...(body.description !== undefined ? { description: body.description.trim() } : {}),
          ...(body.discountAmount !== undefined ? { discountAmount: body.discountAmount } : {}),
          ...(body.discountPercent !== undefined ? { discountPercent: body.discountPercent } : {}),
          ...(body.minSpend !== undefined ? { minSpend: body.minSpend } : {}),
          ...(body.validUntil !== undefined ? { validUntil: body.validUntil } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
        },
      });

      if (updated.count === 0) {
        return reply.status(404).send({ error: "Promo tidak ditemukan" });
      }

      const item = await prisma.promoVoucher.findUnique({ where: { id } });
      return item;
    },
  );

  // Delete Promo
  app.delete(
    "/promos/:id",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const res = await prisma.promoVoucher.deleteMany({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (res.count === 0) {
        return reply.status(404).send({ error: "Promo tidak ditemukan" });
      }
      return { ok: true };
    },
  );
}
