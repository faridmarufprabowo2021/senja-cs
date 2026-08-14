import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, requireTenant } from "../lib/auth.js";
import { mapContact } from "../lib/mappers.js";

export function mapPipelineDeal(d: any) {
  return {
    id: d.id,
    tenantId: d.tenantId,
    pipelineId: d.pipelineId,
    stageId: d.stageId,
    contactId: d.contactId,
    conversationId: d.conversationId || null,
    title: d.title,
    amount: d.amount,
    status: d.status || "open",
    lastAiReason: d.lastAiReason || null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    contact: d.contact ? mapContact(d.contact) : undefined,
    stage: d.stage
      ? {
          id: d.stage.id,
          pipelineId: d.stage.pipelineId,
          name: d.stage.name,
          color: d.stage.color,
          orderIndex: d.stage.orderIndex,
          autoRules: d.stage.autoRules || null,
          createdAt: d.stage.createdAt.toISOString(),
          updatedAt: d.stage.updatedAt.toISOString(),
        }
      : undefined,
  };
}

export function mapPipelineStage(s: any) {
  return {
    id: s.id,
    pipelineId: s.pipelineId,
    name: s.name,
    color: s.color,
    orderIndex: s.orderIndex,
    autoRules: s.autoRules || null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    deals: s.deals ? s.deals.map(mapPipelineDeal) : [],
  };
}

export function mapPipeline(p: any) {
  return {
    id: p.id,
    tenantId: p.tenantId,
    name: p.name,
    isDefault: p.isDefault,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    stages: p.stages ? p.stages.map(mapPipelineStage) : [],
  };
}

export async function ensureDefaultPipeline(tenantId: string) {
  const count = await prisma.pipeline.count({ where: { tenantId } });
  if (count > 0) return;

  const defaultPipeline = await prisma.pipeline.create({
    data: {
      tenantId,
      name: "Default Sales Pipeline",
      isDefault: true,
      stages: {
        create: [
          { name: "1. Lead Masuk", color: "#3b82f6", orderIndex: 0, autoRules: "lead_inbound" },
          { name: "2. Kualifikasi", color: "#8b5cf6", orderIndex: 1, autoRules: "qualification" },
          { name: "3. Proposal / Invoice", color: "#f59e0b", orderIndex: 2, autoRules: "proposal" },
          { name: "4. Closing Lunas", color: "#10b981", orderIndex: 3, autoRules: "closing" },
          { name: "5. Batal / Lost", color: "#ef4444", orderIndex: 4, autoRules: "lost" },
        ],
      },
    },
  });

  return defaultPipeline;
}

export async function pipelineRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  // 1. GET /pipelines - List pipelines & stages
  app.get("/pipelines", async (request) => {
    await ensureDefaultPipeline(request.tenant.tenantId);

    const pipelines = await prisma.pipeline.findMany({
      where: { tenantId: request.tenant.tenantId },
      include: {
        stages: {
          orderBy: { orderIndex: "asc" },
          include: {
            deals: {
              include: {
                contact: {
                  include: {
                    orders: { select: { id: true, total: true, status: true } },
                    bookings: { select: { id: true, status: true } },
                  },
                },
              },
              orderBy: { updatedAt: "desc" },
            },
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return pipelines.map(mapPipeline);
  });

  // 2. POST /pipelines/deals - Create a new deal
  app.post(
    "/pipelines/deals",
    { preHandler: [requireRole("owner", "admin", "agent")] },
    async (request) => {
      const body = z
        .object({
          pipelineId: z.string().min(1),
          stageId: z.string().min(1),
          contactId: z.string().min(1),
          conversationId: z.string().optional(),
          title: z.string().min(1).max(120),
          amount: z.number().int().min(0).default(0),
          status: z.enum(["open", "won", "lost"]).default("open"),
        })
        .parse(request.body);

      const deal = await prisma.pipelineDeal.create({
        data: {
          tenantId: request.tenant.tenantId,
          pipelineId: body.pipelineId,
          stageId: body.stageId,
          contactId: body.contactId,
          conversationId: body.conversationId || null,
          title: body.title,
          amount: body.amount,
          status: body.status,
        },
        include: {
          contact: {
            include: {
              orders: { select: { id: true, total: true, status: true } },
              bookings: { select: { id: true, status: true } },
            },
          },
          stage: true,
        },
      });

      return mapPipelineDeal(deal);
    },
  );

  // 3. PATCH /pipelines/deals/:id - Move deal stage / update amount / status
  app.patch(
    "/pipelines/deals/:id",
    { preHandler: [requireRole("owner", "admin", "agent")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          stageId: z.string().optional(),
          title: z.string().min(1).max(120).optional(),
          amount: z.number().int().min(0).optional(),
          status: z.enum(["open", "won", "lost"]).optional(),
          lastAiReason: z.string().max(500).optional(),
        })
        .parse(request.body);

      const existing = await prisma.pipelineDeal.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!existing) return reply.status(404).send({ error: "Deal not found" });

      const updated = await prisma.pipelineDeal.update({
        where: { id },
        data: body,
        include: {
          contact: {
            include: {
              orders: { select: { id: true, total: true, status: true } },
              bookings: { select: { id: true, status: true } },
            },
          },
          stage: true,
        },
      });

      return mapPipelineDeal(updated);
    },
  );

  // 4. DELETE /pipelines/deals/:id - Delete deal
  app.delete(
    "/pipelines/deals/:id",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.pipelineDeal.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!existing) return reply.status(404).send({ error: "Deal not found" });

      await prisma.pipelineDeal.delete({ where: { id } });
      return { ok: true };
    },
  );
}
