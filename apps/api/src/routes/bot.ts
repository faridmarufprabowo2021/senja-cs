import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, requireTenant } from "../lib/auth.js";

function mapSettings(s: {
  enabled: boolean;
  systemPrompt: string;
  confidenceThreshold: number;
  handoverKeywords: string[];
  maxBotTurns: number;
  model: string;
  businessHoursEnabled: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  businessHoursTz: string;
  awayMessage: string;
  quickReplies: string[];
  cancelDeadlineHours?: number;
  shippingOrigin?: string;
}) {
  return {
    enabled: s.enabled,
    systemPrompt: s.systemPrompt,
    confidenceThreshold: s.confidenceThreshold,
    handoverKeywords: s.handoverKeywords,
    maxBotTurns: s.maxBotTurns,
    model: s.model,
    businessHoursEnabled: s.businessHoursEnabled,
    businessHoursStart: s.businessHoursStart,
    businessHoursEnd: s.businessHoursEnd,
    businessHoursTz: s.businessHoursTz,
    awayMessage: s.awayMessage,
    quickReplies: s.quickReplies,
    cancelDeadlineHours: s.cancelDeadlineHours ?? 2,
    shippingOrigin: s.shippingOrigin ?? "Surakarta",
  };
}

export async function botRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  app.get("/bot/settings", async (request) => {
    const s = await prisma.botSettings.upsert({
      where: { tenantId: request.tenant.tenantId },
      create: { tenantId: request.tenant.tenantId },
      update: {},
    });
    return mapSettings(s);
  });

  app.get("/bot/quick-replies", async (request) => {
    const s = await prisma.botSettings.upsert({
      where: { tenantId: request.tenant.tenantId },
      create: { tenantId: request.tenant.tenantId },
      update: {},
    });
    return { quickReplies: s.quickReplies };
  });

  app.patch(
    "/bot/settings",
    { preHandler: [requireRole("owner", "admin")] },
    async (request) => {
      const body = z
        .object({
          enabled: z.boolean().optional(),
          systemPrompt: z.string().min(1).max(4000).optional(),
          confidenceThreshold: z.number().min(0).max(1).optional(),
          handoverKeywords: z.array(z.string()).optional(),
          maxBotTurns: z.number().int().min(1).max(50).optional(),
          model: z.string().min(1).max(80).optional(),
          businessHoursEnabled: z.boolean().optional(),
          businessHoursStart: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .optional(),
          businessHoursEnd: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .optional(),
          businessHoursTz: z.string().min(1).max(60).optional(),
          awayMessage: z.string().min(1).max(1000).optional(),
          quickReplies: z.array(z.string().min(1).max(500)).max(30).optional(),
          cancelDeadlineHours: z.number().int().min(1).max(168).optional(),
          shippingOrigin: z.string().min(1).max(100).optional(),
        })
        .parse(request.body);

      const s = await prisma.botSettings.upsert({
        where: { tenantId: request.tenant.tenantId },
        create: {
          tenantId: request.tenant.tenantId,
          ...body,
          handoverKeywords: body.handoverKeywords ?? [
            "cs",
            "admin",
            "human",
            "agent",
            "manusia",
          ],
        },
        update: body,
      });
      return mapSettings(s);
    },
  );

  app.get("/bot/logs", async (request) => {
    const q = request.query as { conversationId?: string; limit?: string };
    const messages = await prisma.message.findMany({
      where: {
        tenantId: request.tenant.tenantId,
        senderType: "bot",
        ...(q.conversationId ? { conversationId: q.conversationId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(q.limit) || 50, 100),
    });
    return messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      metadata: m.metadata,
    }));
  });
}
