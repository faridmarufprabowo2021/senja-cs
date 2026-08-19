import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ConversationStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireTenant } from "../lib/auth.js";
import {
  emptyMetrics,
  mapConversation,
  mapMessage,
} from "../lib/mappers.js";
import { hub } from "../ws/hub.js";
import { publicMediaUrl, saveBuffer } from "../lib/storage.js";
import { waManager } from "../wa/manager.js";

export async function inboxRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  app.get("/conversations", async (request) => {
    const q = request.query as {
      status?: ConversationStatus | "all";
      assignee?: string;
      search?: string;
    };

    const where = {
      tenantId: request.tenant.tenantId,
      ...(q.status && q.status !== "all" ? { status: q.status } : {}),
      ...(q.assignee === "me"
        ? { assignedTo: request.authUser.id }
        : q.assignee
          ? { assignedTo: q.assignee }
          : {}),
      ...(q.search
        ? {
            OR: [
              { lastMessagePreview: { contains: q.search, mode: "insensitive" as const } },
              { contact: { name: { contains: q.search, mode: "insensitive" as const } } },
              { contact: { phone: { contains: q.search } } },
            ],
          }
        : {}),
    };

    const rows = await prisma.conversation.findMany({
      where,
      include: { contact: true, assignee: true, aiAgent: { select: { id: true, name: true } } },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    });

    return rows.map(mapConversation);
  });

  app.get("/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await prisma.conversation.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
      include: { contact: true, assignee: true, aiAgent: { select: { id: true, name: true } } },
    });
    if (!row) return reply.code(404).send({ error: "Not found" });
    return mapConversation(row);
  });

  app.get("/conversations/:id/insights", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenant.tenantId;

    const conv = await prisma.conversation.findFirst({
      where: { id, tenantId },
    });
    if (!conv) return reply.code(404).send({ error: "Conversation not found" });

    const { getConversationInsights } = await import("../lib/chat-insight-engine.js");
    const insights = await getConversationInsights(tenantId, id);
    return insights;
  });

  app.get("/conversations/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as { cursor?: string; limit?: string };
    const limit = Math.min(Number(q.limit) || 50, 100);

    const conv = await prisma.conversation.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
    });
    if (!conv) return reply.code(404).send({ error: "Not found" });

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        tenantId: request.tenant.tenantId,
        ...(q.cursor ? { createdAt: { lt: new Date(q.cursor) } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    // mark read
    if (conv.unreadCount > 0) {
      const updated = await prisma.conversation.update({
        where: { id },
        data: { unreadCount: 0 },
        include: { contact: true, assignee: true, aiAgent: { select: { id: true, name: true } } },
      });
      hub.toTenant(
        request.tenant.tenantId,
        "conversation.updated",
        mapConversation(updated),
      );
    }

    return messages.map(mapMessage);
  });

  app.post("/conversations/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ body: z.string().min(1) }).parse(request.body);

    const conv = await prisma.conversation.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
      include: { contact: true },
    });
    if (!conv) return reply.code(404).send({ error: "Not found" });
    if (!conv.waSessionId) {
      return reply.code(400).send({ error: "No WA session on conversation" });
    }

    let waMessageId: string | null = null;
    let rawProto: string | null = null;
    try {
      const sent = await waManager.sendText(
        conv.waSessionId,
        conv.contact.waJid,
        body.body,
      );
      waMessageId = sent?.key?.id ?? null;
      rawProto = (sent as any)?.rawProto ?? (sent?.message ? JSON.stringify(sent.message) : null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return reply.code(503).send({
        error: detail.includes("WhatsApp")
          ? detail
          : `Gagal kirim WhatsApp: ${detail}`,
      });
    }

    const now = new Date();
    const message = await prisma.message.create({
      data: {
        tenantId: request.tenant.tenantId,
        conversationId: id,
        direction: "out",
        senderType: "agent",
        senderId: request.authUser.id,
        senderName: request.authUser.name,
        type: "text",
        body: body.body,
        waMessageId,
        rawProto,
      },
    });

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        lastMessagePreview: body.body,
        lastMessageAt: now,
        mode: "human",
        status: conv.status === "waiting_agent" || conv.status === "bot_active"
          ? "assigned"
          : conv.status,
        assignedTo: conv.assignedTo ?? request.authUser.id,
        unreadCount: 0,
      },
      include: { contact: true, assignee: true, aiAgent: { select: { id: true, name: true } } },
    });

    const mappedMsg = mapMessage(message);
    const mappedConv = mapConversation(updated);
    hub.toTenant(request.tenant.tenantId, "message.created", mappedMsg);
    hub.toTenant(request.tenant.tenantId, "conversation.updated", mappedConv);

    return reply.code(201).send(mappedMsg);
  });

  app.post("/conversations/:id/media", async (request, reply) => {
    const { id } = request.params as { id: string };
    const conv = await prisma.conversation.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
      include: { contact: true },
    });
    if (!conv) return reply.code(404).send({ error: "Not found" });
    if (!conv.waSessionId) {
      return reply.code(400).send({ error: "No WA session on conversation" });
    }

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "File required" });
    const buf = await file.toBuffer();
    if (buf.length > 8 * 1024 * 1024) {
      return reply.code(400).send({ error: "Max 8MB" });
    }
    const caption = (file.fields as { caption?: { value?: string } })?.caption
      ?.value;
    const mime = file.mimetype || "application/octet-stream";
    const isImage = mime.startsWith("image/");
    const ext =
      file.filename?.split(".").pop()?.toLowerCase() ||
      (isImage ? "jpg" : "bin");
    const { relativePath } = saveBuffer(request.tenant.tenantId, buf, ext);
    const mediaUrl = publicMediaUrl(relativePath);

    let waMessageId: string | null = null;
    let rawProto: string | null = null;
    try {
      const sent = await waManager.sendMedia(conv.waSessionId, conv.contact.waJid, {
        buffer: buf,
        mimetype: mime,
        fileName: file.filename || `file.${ext}`,
        caption: caption || undefined,
        isImage,
      });
      waMessageId = sent?.key?.id ?? null;
      rawProto = (sent as any)?.rawProto ?? (sent?.message ? JSON.stringify(sent.message) : null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return reply.code(503).send({
        error: detail.includes("WhatsApp")
          ? detail
          : `Gagal kirim media: ${detail}`,
      });
    }

    const now = new Date();
    const preview = isImage ? "[gambar]" : `[dokumen] ${file.filename || ""}`;
    const message = await prisma.message.create({
      data: {
        tenantId: request.tenant.tenantId,
        conversationId: id,
        direction: "out",
        senderType: "agent",
        senderId: request.authUser.id,
        senderName: request.authUser.name,
        type: isImage ? "image" : "document",
        body: caption || preview,
        waMessageId,
        rawProto,
        metadata: {
          mediaUrl,
          mimeType: mime,
          fileName: file.filename,
        },
      },
    });

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        lastMessagePreview: preview.slice(0, 200),
        lastMessageAt: now,
        mode: "human",
        status:
          conv.status === "waiting_agent" || conv.status === "bot_active"
            ? "assigned"
            : conv.status,
        assignedTo: conv.assignedTo ?? request.authUser.id,
        unreadCount: 0,
      },
      include: { contact: true, assignee: true, aiAgent: { select: { id: true, name: true } } },
    });

    const mappedMsg = mapMessage(message);
    hub.toTenant(request.tenant.tenantId, "message.created", mappedMsg);
    hub.toTenant(
      request.tenant.tenantId,
      "conversation.updated",
      mapConversation(updated),
    );
    return reply.code(201).send(mappedMsg);
  });

  app.patch("/conversations/:id/tags", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        tags: z.array(z.string().min(1).max(40)).max(20),
      })
      .parse(request.body);

    const conv = await prisma.conversation.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
    });
    if (!conv) return reply.code(404).send({ error: "Not found" });

    const tags = [
      ...new Set(body.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
    ];
    await prisma.contact.update({
      where: { id: conv.contactId },
      data: { tags },
    });

    const row = await prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: { contact: true, assignee: true, aiAgent: { select: { id: true, name: true } } },
    });
    const mapped = mapConversation(row);
    hub.toTenant(request.tenant.tenantId, "conversation.updated", mapped);
    return mapped;
  });

  app.post("/conversations/:id/assign", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({ userId: z.string().optional() })
      .parse(request.body ?? {});
    const userId = body.userId ?? request.authUser.id;

    const member = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: request.tenant.tenantId,
          userId,
        },
      },
      include: { user: true },
    });
    if (!member) return reply.code(400).send({ error: "User not in tenant" });

    const updated = await prisma.conversation.updateMany({
      where: { id, tenantId: request.tenant.tenantId },
      data: {
        assignedTo: userId,
        status: "assigned",
        mode: "human",
      },
    });
    if (!updated.count) return reply.code(404).send({ error: "Not found" });

    const row = await prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: { contact: true, assignee: true, aiAgent: { select: { id: true, name: true } } },
    });

    await prisma.message.create({
      data: {
        tenantId: request.tenant.tenantId,
        conversationId: id,
        direction: "out",
        senderType: "system",
        type: "system",
        body: `Chat diambil oleh ${member.user.name}`,
      },
    });

    const mapped = mapConversation(row);
    hub.toTenant(request.tenant.tenantId, "conversation.updated", mapped);
    return mapped;
  });

  app.post("/conversations/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        status: z.enum([
          "new",
          "bot_active",
          "waiting_agent",
          "assigned",
          "resolved",
        ]),
      })
      .parse(request.body);

    const result = await prisma.conversation.updateMany({
      where: { id, tenantId: request.tenant.tenantId },
      data: {
        status: body.status,
        resolvedAt: body.status === "resolved" ? new Date() : null,
      },
    });
    if (!result.count) return reply.code(404).send({ error: "Not found" });

    const row = await prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: { contact: true, assignee: true, aiAgent: { select: { id: true, name: true } } },
    });
    const mapped = mapConversation(row);
    hub.toTenant(request.tenant.tenantId, "conversation.updated", mapped);
    return mapped;
  });

  app.post("/conversations/:id/mode", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ mode: z.enum(["bot", "human"]) }).parse(request.body);

    const result = await prisma.conversation.updateMany({
      where: { id, tenantId: request.tenant.tenantId },
      data: {
        mode: body.mode,
        status: body.mode === "bot" ? "bot_active" : "assigned",
      },
    });
    if (!result.count) return reply.code(404).send({ error: "Not found" });

    const row = await prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: { contact: true, assignee: true, aiAgent: { select: { id: true, name: true } } },
    });
    const mapped = mapConversation(row);
    hub.toTenant(request.tenant.tenantId, "conversation.updated", mapped);
    return mapped;
  });

  app.get("/metrics/overview", async (request) => {
    const tenantId = request.tenant.tenantId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      openChats,
      waitingAgent,
      resolvedToday,
      resolvedBotToday,
      messagesToday,
      recentConvos,
    ] = await Promise.all([
      prisma.conversation.count({
        where: { tenantId, status: { not: "resolved" } },
      }),
      prisma.conversation.count({
        where: { tenantId, status: "waiting_agent" },
      }),
      prisma.conversation.count({
        where: {
          tenantId,
          status: "resolved",
          resolvedAt: { gte: startOfDay },
        },
      }),
      prisma.conversation.count({
        where: {
          tenantId,
          status: "resolved",
          mode: "bot",
          resolvedAt: { gte: startOfDay },
        },
      }),
      prisma.message.count({
        where: { tenantId, createdAt: { gte: startOfDay } },
      }),
      prisma.conversation.findMany({
        where: {
          tenantId,
          lastMessageAt: { gte: startOfDay },
        },
        select: { id: true, createdAt: true },
        take: 80,
        orderBy: { lastMessageAt: "desc" },
      }),
    ]);

    // First response time: first inbound → first outbound (bot/agent) today sample
    const frts: number[] = [];
    for (const c of recentConvos.slice(0, 40)) {
      const msgs = await prisma.message.findMany({
        where: { conversationId: c.id },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { direction: true, senderType: true, createdAt: true },
      });
      const firstIn = msgs.find(
        (m) => m.direction === "in" && m.senderType === "customer",
      );
      if (!firstIn) continue;
      const firstOut = msgs.find(
        (m) =>
          m.direction === "out" &&
          (m.senderType === "bot" || m.senderType === "agent") &&
          m.createdAt > firstIn.createdAt,
      );
      if (!firstOut) continue;
      const sec = Math.round(
        (firstOut.createdAt.getTime() - firstIn.createdAt.getTime()) / 1000,
      );
      if (sec >= 0 && sec < 86_400) frts.push(sec);
    }
    frts.sort((a, b) => a - b);
    const medianFrt =
      frts.length === 0
        ? 0
        : frts[Math.floor(frts.length / 2)] ?? 0;

    const metrics = emptyMetrics();
    metrics.openChats = openChats;
    metrics.waitingAgent = waitingAgent;
    metrics.messagesToday = messagesToday;
    metrics.botResolvedPct =
      resolvedToday === 0
        ? 0
        : Math.round((resolvedBotToday / resolvedToday) * 100);
    metrics.avgFirstResponseSec = medianFrt;
    return metrics;
  });

  app.get("/metrics/analytics", async (request) => {
    const tenantId = request.tenant.tenantId;

    // 1. Calculate 7-day trends
    const trends: import("@cs/shared").AnalyticsTrendPoint[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const [chatsInbound, ordersCreated, ordersPaidRaw] = await Promise.all([
        prisma.message.count({
          where: {
            tenantId,
            direction: "in",
            createdAt: { gte: d, lt: nextD },
          },
        }),
        prisma.order.count({
          where: {
            tenantId,
            createdAt: { gte: d, lt: nextD },
          },
        }),
        prisma.order.aggregate({
          where: {
            tenantId,
            status: "paid",
            updatedAt: { gte: d, lt: nextD },
          },
          _count: { id: true },
          _sum: { total: true },
        }),
      ]);

      const label = d.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });

      trends.push({
        date: d.toISOString().split("T")[0],
        label,
        chatsInbound,
        ordersCreated,
        ordersPaid: ordersPaidRaw._count.id || 0,
        revenuePaid: ordersPaidRaw._sum.total || 0,
      });
    }

    // 2. Funnel Stages
    const [totalConvos, botConvos, draftOrders, paidOrders] = await Promise.all([
      prisma.conversation.count({ where: { tenantId } }),
      prisma.conversation.count({ where: { tenantId, mode: "bot" } }),
      prisma.order.count({ where: { tenantId, status: { in: ["draft", "confirmed", "paid"] } } }),
      prisma.order.count({ where: { tenantId, status: "paid" } }),
    ]);

    const baseCount = Math.max(1, totalConvos);
    const funnel: import("@cs/shared").FunnelStage[] = [
      {
        stage: "chats",
        label: "Pesan WA Masuk",
        count: totalConvos,
        conversionPct: 100,
      },
      {
        stage: "bot_replied",
        label: "Ditangani AI Bot",
        count: botConvos,
        conversionPct: Math.round((botConvos / baseCount) * 100),
      },
      {
        stage: "order_draft",
        label: "Draf Order Dibuat",
        count: draftOrders,
        conversionPct: Math.round((draftOrders / baseCount) * 100),
      },
      {
        stage: "order_paid",
        label: "Lunas (Paid)",
        count: paidOrders,
        conversionPct: Math.round((paidOrders / baseCount) * 100),
      },
    ];

    // 3. Agent Leaderboard
    const members = await prisma.tenantMember.findMany({
      where: { tenantId, status: "active" },
      include: { user: true },
    });

    const leaderboard: import("@cs/shared").AgentLeaderboardItem[] = [];

    for (const m of members) {
      const [assignedChats, resolvedChats] = await Promise.all([
        prisma.conversation.count({
          where: { tenantId, assignedTo: m.userId },
        }),
        prisma.conversation.count({
          where: { tenantId, assignedTo: m.userId, status: "resolved" },
        }),
      ]);

      leaderboard.push({
        id: m.userId,
        name: m.user.name,
        role: m.role,
        assignedChats,
        resolvedChats,
        avgResponseSec: 45, // Default average response time estimate in seconds
      });
    }

    leaderboard.sort((a, b) => b.resolvedChats - a.resolvedChats);

    // Basic overview metrics
    const overviewRes = await app.inject({
      method: "GET",
      url: "/api/v1/metrics/overview",
      headers: request.headers as any,
    });

    const metrics = overviewRes.json() as import("@cs/shared").DashboardMetrics;

    return {
      metrics,
      trends,
      funnel,
      leaderboard,
    };
  });
}
