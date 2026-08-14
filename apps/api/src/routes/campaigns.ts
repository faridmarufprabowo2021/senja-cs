import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, requireTenant } from "../lib/auth.js";
import { cancelCampaign, createCampaign } from "../lib/campaigns.js";
import type { Campaign, CampaignRecipient } from "@cs/shared";

function mapCampaign(c: {
  id: string;
  name: string;
  message: string;
  imageUrl?: string | null;
  targetTag: string | null;
  status: string;
  delayMinSec: number;
  delayMaxSec: number;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
}): Campaign {
  return {
    id: c.id,
    name: c.name,
    message: c.message,
    imageUrl: c.imageUrl,
    targetTag: c.targetTag,
    status: c.status as Campaign["status"],
    delayMinSec: c.delayMinSec,
    delayMaxSec: c.delayMaxSec,
    totalCount: c.totalCount,
    sentCount: c.sentCount,
    failedCount: c.failedCount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function campaignRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  // Get Templates
  app.get("/campaigns/templates", async (request) => {
    const templates = await prisma.broadcastTemplate.findMany({
      where: { tenantId: request.tenant.tenantId },
      orderBy: { createdAt: "desc" },
    });
    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      message: t.message,
      imageUrl: t.imageUrl,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  });

  // Create Template
  app.post(
    "/campaigns/templates",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const body = z
        .object({
          name: z.string().min(1).max(100),
          message: z.string().min(1).max(2000),
          imageUrl: z.string().nullable().optional(),
        })
        .parse(request.body);

      const created = await prisma.broadcastTemplate.create({
        data: {
          tenantId: request.tenant.tenantId,
          name: body.name.trim(),
          message: body.message,
          imageUrl: body.imageUrl?.trim() || null,
        },
      });

      return reply.code(201).send({
        id: created.id,
        name: created.name,
        message: created.message,
        imageUrl: created.imageUrl,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      });
    },
  );

  // Delete Template
  app.delete(
    "/campaigns/templates/:id",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const res = await prisma.broadcastTemplate.deleteMany({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (res.count === 0) return reply.code(404).send({ error: "Template not found" });
      return { ok: true };
    },
  );

  app.get("/campaigns", async (request) => {
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId: request.tenant.tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return campaigns.map(mapCampaign);
  });

  app.get("/campaigns/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await prisma.campaign.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
      include: {
        recipients: {
          include: { contact: true },
          take: 500,
        },
      },
    });

    if (!row) return reply.code(404).send({ error: "Campaign not found" });

    const mappedRecipients: CampaignRecipient[] = row.recipients.map((r) => ({
      id: r.id,
      campaignId: r.campaignId,
      contactId: r.contactId,
      contactName: r.contact.name,
      contactPhone: r.contact.phone,
      status: r.status as CampaignRecipient["status"],
      sentAt: r.sentAt?.toISOString(),
      error: r.error || undefined,
    }));

    return {
      campaign: mapCampaign(row),
      recipients: mappedRecipients,
    };
  });

  app.post(
    "/campaigns",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const body = z
        .object({
          name: z.string().min(1).max(100),
          message: z.string().min(1).max(2000),
          imageUrl: z.string().nullable().optional(),
          targetTag: z.string().nullable().optional(),
          delayMinSec: z.number().int().min(1).max(60).optional(),
          delayMaxSec: z.number().int().min(1).max(120).optional(),
        })
        .parse(request.body);

      const campaign = await createCampaign({
        tenantId: request.tenant.tenantId,
        name: body.name,
        message: body.message,
        imageUrl: body.imageUrl,
        targetTag: body.targetTag,
        delayMinSec: body.delayMinSec,
        delayMaxSec: body.delayMaxSec,
      });

      return reply.code(201).send(mapCampaign(campaign));
    },
  );

  app.post(
    "/campaigns/:id/cancel",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const updated = await cancelCampaign(request.tenant.tenantId, id);
      if (!updated) return reply.code(404).send({ error: "Campaign not found" });
      return mapCampaign(updated);
    },
  );
}
