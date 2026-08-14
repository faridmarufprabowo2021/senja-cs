import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, requireTenant } from "../lib/auth.js";
import { chatComplete } from "../lib/llm.js";
import { retrieveChunks } from "../bot/retrieve.js";
import { SYSTEM_TOOLS_DEFINITIONS } from "../tools/schemas.js";

export function mapAiAgent(agent: any) {
  return {
    id: agent.id,
    tenantId: agent.tenantId,
    name: agent.name,
    description: agent.description || "",
    avatarUrl: agent.avatarUrl || null,
    enabled: agent.enabled,
    isDefault: agent.isDefault,
    systemPrompt: agent.systemPrompt,
    welcomeMessage: agent.welcomeMessage,
    welcomeImageUrl: agent.welcomeImageUrl || null,
    model: agent.model,
    confidenceThreshold: agent.confidenceThreshold,
    handoverKeywords: agent.handoverKeywords || [],
    cancelDeadlineHours: agent.cancelDeadlineHours ?? 2,
    transferConditions: agent.transferConditions || null,
    followupEnabled: agent.followupEnabled ?? false,
    followupAiDynamic: agent.followupAiDynamic ?? true,
    followupDelayMinutes: agent.followupDelayMinutes ?? 15,
    followupMessage: agent.followupMessage || "Halo Kak, apakah ada yang ingin ditanyakan lagi terkait pesanan/booking tadi? 😊",
    followupStage2Enabled: agent.followupStage2Enabled ?? false,
    followupStage2DelayMinutes: agent.followupStage2DelayMinutes ?? 1440,
    followupStage2Message: agent.followupStage2Message || "Halo Kak, khusus hari ini kami ada penawaran spesial voucher diskon jika Kakak ingin menyelesaikan reservasi/pesanan kemarin. Mau kami bantu proses sekarang? 😊",
    waSessionId: agent.waSessionId || null,
    channel: agent.channel || "all",
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    knowledgeDocIds: agent.knowledgeDocs ? agent.knowledgeDocs.map((d: any) => d.id) : [],
  };
}

export async function ensureDefaultAgent(tenantId: string) {
  const count = await prisma.aiAgent.count({ where: { tenantId } });
  if (count > 0) return;

  const bot = await prisma.botSettings.findUnique({ where: { tenantId } });
  await prisma.aiAgent.create({
    data: {
      tenantId,
      name: "Utama CS Agent",
      description: "Agent CS & Sales default toko",
      isDefault: true,
      enabled: bot?.enabled ?? true,
      systemPrompt: bot?.systemPrompt ?? "Kamu CS WhatsApp & Instagram. Jawab singkat, ramah, Bahasa Indonesia. Hanya gunakan konteks knowledge. Jika tidak tahu, tawarkan hubungi agent.",
      model: bot?.model ?? "claude-sonnet-4.5",
      confidenceThreshold: bot?.confidenceThreshold ?? 0.15,
      handoverKeywords: bot?.handoverKeywords ?? ["cs", "admin", "human", "manusia"],
      cancelDeadlineHours: bot?.cancelDeadlineHours ?? 2,
      welcomeMessage: "Halo! Selamat datang di layanan pelanggan kami. Ada yang bisa saya bantu hari ini? 😊",
      transferConditions: "Pengalihan otomatis ke CS jika pelanggan meminta bantuan manusia atau terdeteksi komplain berat.",
      followupEnabled: false,
      followupDelayMinutes: 15,
      followupMessage: "Halo Kak, apakah ada yang ingin ditanyakan lagi terkait pesanan/booking tadi? 😊 Kami siap bantu jika Kakak ingin lanjut.",
    },
  });
}

export async function aiAgentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  // 1. List all agents
  app.get("/ai-agents", async (request) => {
    await ensureDefaultAgent(request.tenant.tenantId);
    const agents = await prisma.aiAgent.findMany({
      where: { tenantId: request.tenant.tenantId },
      include: { knowledgeDocs: { select: { id: true } } },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    return agents.map(mapAiAgent);
  });

  // 2. Create new agent
  app.post(
    "/ai-agents",
    { preHandler: [requireRole("owner", "admin")] },
    async (request) => {
      const body = z
        .object({
          name: z.string().min(1).max(80),
          description: z.string().max(300).optional(),
          avatarUrl: z.string().url().or(z.literal("")).optional(),
          systemPrompt: z.string().min(1).max(4000).optional(),
          welcomeMessage: z.string().min(1).max(1000).optional(),
          welcomeImageUrl: z.string().url().or(z.literal("")).optional(),
          model: z.string().min(1).max(80).optional(),
          confidenceThreshold: z.number().min(0).max(1).optional(),
          handoverKeywords: z.array(z.string()).optional(),
          cancelDeadlineHours: z.number().int().min(1).max(168).optional(),
          transferConditions: z.string().max(1000).optional(),
          followupEnabled: z.boolean().optional(),
          followupAiDynamic: z.boolean().optional(),
          followupDelayMinutes: z.number().int().min(1).max(10080).optional(),
          followupMessage: z.string().max(1000).optional(),
          followupStage2Enabled: z.boolean().optional(),
          followupStage2DelayMinutes: z.number().int().min(1).max(10080).optional(),
          followupStage2Message: z.string().max(1000).optional(),
          waSessionId: z.string().nullable().optional(),
          channel: z.enum(["whatsapp", "instagram", "all"]).optional(),
        })
        .parse(request.body);

      const agent = await prisma.aiAgent.create({
        data: {
          tenantId: request.tenant.tenantId,
          name: body.name,
          description: body.description || "",
          avatarUrl: body.avatarUrl || null,
          systemPrompt: body.systemPrompt || "Kamu CS WhatsApp & Instagram. Jawab singkat, ramah, Bahasa Indonesia.",
          welcomeMessage: body.welcomeMessage || "Halo! Selamat datang di layanan kami.",
          welcomeImageUrl: body.welcomeImageUrl || null,
          model: body.model || "claude-sonnet-4.5",
          confidenceThreshold: body.confidenceThreshold ?? 0.15,
          handoverKeywords: body.handoverKeywords || ["cs", "admin", "human"],
          cancelDeadlineHours: body.cancelDeadlineHours ?? 2,
          transferConditions: body.transferConditions || null,
          followupEnabled: body.followupEnabled ?? false,
          followupAiDynamic: body.followupAiDynamic ?? true,
          followupDelayMinutes: body.followupDelayMinutes ?? 15,
          followupMessage: body.followupMessage || "Halo Kak, apakah ada yang ingin ditanyakan lagi terkait pesanan/booking tadi? 😊",
          followupStage2Enabled: body.followupStage2Enabled ?? false,
          followupStage2DelayMinutes: body.followupStage2DelayMinutes ?? 1440,
          followupStage2Message: body.followupStage2Message || "Halo Kak, khusus hari ini kami ada penawaran spesial voucher diskon jika Kakak ingin menyelesaikan reservasi/pesanan kemarin. Mau kami bantu proses sekarang? 😊",
          waSessionId: body.waSessionId || null,
          channel: body.channel || "all",
        },
        include: { knowledgeDocs: { select: { id: true } } },
      });

      return mapAiAgent(agent);
    },
  );

  // 3. Get single agent detail
  app.get("/ai-agents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = await prisma.aiAgent.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
      include: { knowledgeDocs: { select: { id: true } } },
    });
    if (!agent) return reply.status(404).send({ error: "Agent not found" });
    return mapAiAgent(agent);
  });

  // 4. Update agent
  app.patch(
    "/ai-agents/:id",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          name: z.string().min(1).max(80).optional(),
          description: z.string().max(300).optional(),
          avatarUrl: z.string().url().or(z.literal("")).nullable().optional(),
          enabled: z.boolean().optional(),
          isDefault: z.boolean().optional(),
          systemPrompt: z.string().min(1).max(4000).optional(),
          welcomeMessage: z.string().min(1).max(1000).optional(),
          welcomeImageUrl: z.string().url().or(z.literal("")).nullable().optional(),
          model: z.string().min(1).max(80).optional(),
          confidenceThreshold: z.number().min(0).max(1).optional(),
          handoverKeywords: z.array(z.string()).optional(),
          cancelDeadlineHours: z.number().int().min(1).max(168).optional(),
          transferConditions: z.string().max(1000).nullable().optional(),
          followupEnabled: z.boolean().optional(),
          followupAiDynamic: z.boolean().optional(),
          followupDelayMinutes: z.number().int().min(1).max(10080).optional(),
          followupMessage: z.string().max(1000).optional(),
          followupStage2Enabled: z.boolean().optional(),
          followupStage2DelayMinutes: z.number().int().min(1).max(10080).optional(),
          followupStage2Message: z.string().max(1000).optional(),
          waSessionId: z.string().nullable().optional(),
          channel: z.enum(["whatsapp", "instagram", "all"]).optional(),
          knowledgeDocIds: z.array(z.string()).optional(),
        })
        .parse(request.body);

      const existing = await prisma.aiAgent.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!existing) return reply.status(404).send({ error: "Agent not found" });

      // Handle knowledgeDocIds binding if provided
      if (body.knowledgeDocIds) {
        // Disconnect old docs
        await prisma.knowledgeDocument.updateMany({
          where: { tenantId: request.tenant.tenantId, aiAgentId: id },
          data: { aiAgentId: null },
        });
        // Connect new docs
        if (body.knowledgeDocIds.length > 0) {
          await prisma.knowledgeDocument.updateMany({
            where: {
              tenantId: request.tenant.tenantId,
              id: { in: body.knowledgeDocIds },
            },
            data: { aiAgentId: id },
          });
        }
      }

      const { knowledgeDocIds, ...updateData } = body;
      const updated = await prisma.aiAgent.update({
        where: { id },
        data: updateData,
        include: { knowledgeDocs: { select: { id: true } } },
      });

      return mapAiAgent(updated);
    },
  );

  // 5. Delete agent
  app.delete(
    "/ai-agents/:id",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const agent = await prisma.aiAgent.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!agent) return reply.status(404).send({ error: "Agent not found" });
      if (agent.isDefault) {
        return reply.status(400).send({ error: "Cannot delete default AI Agent" });
      }

      await prisma.aiAgent.delete({ where: { id } });
      return { ok: true };
    },
  );

  // 6. Live Test Chat Simulator Endpoint
  app.post(
    "/ai-agents/:id/simulator",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          message: z.string().min(1).max(1000),
          history: z
            .array(
              z.object({
                sender: z.enum(["user", "bot"]),
                text: z.string(),
              }),
            )
            .optional(),
        })
        .parse(request.body);

      const agent = await prisma.aiAgent.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
        include: { knowledgeDocs: true },
      });
      if (!agent) return reply.status(404).send({ error: "Agent not found" });

      // RAG Retrieval
      const chunks = await retrieveChunks(request.tenant.tenantId, body.message, 3);
      const contextText = chunks.length
        ? chunks.map((c) => `[${c.title}]: ${c.content}`).join("\n\n")
        : "(Belum ada konteks knowledge)";

      const historyFormatted = (body.history || [])
        .map((h) => `${h.sender === "user" ? "Pelanggan" : "Bot"}: ${h.text}`)
        .join("\n");

      const sysPrompt = `${agent.systemPrompt}

NAMA BOT / AGENT: ${agent.name}
DEKSRIPSI: ${agent.description || "Agent CS AI"}
ATURAN PENGALIHAN CS: ${agent.transferConditions || "Jika user meminta CS"}

KONTEKS KNOWLEDGE BASE AGENT INI:
${contextText}

HISTORY CHAT SIMULASI:
${historyFormatted}

Petunjuk: Jawab pesan simulasi berikut secara ramah, singkat, dan alami sesuai persona Anda sebagai ${agent.name}.`;

      const res = await chatComplete(
        [
          { role: "system", content: sysPrompt },
          { role: "user", content: body.message },
        ],
        agent.model,
        SYSTEM_TOOLS_DEFINITIONS,
      );

      return {
        reply: res.content || "Maaf, saya tidak mengerti. Silakan tanyakan hal lain.",
        toolCalls: res.toolCalls,
        citations: chunks.map((c) => c.title),
      };
    },
  );
}
