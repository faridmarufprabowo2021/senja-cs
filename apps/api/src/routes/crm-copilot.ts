import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireTenant } from "../lib/auth.js";
import { runCrmCopilotAnalysis } from "../lib/crm-copilot-engine.js";

export async function crmCopilotRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  // GET list of copilot analysis sessions
  app.get("/crm-copilot/sessions", async (request) => {
    const tenantId = request.tenant.tenantId;
    const sessions = await prisma.crmCopilotSession.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      take: 30,
    });

    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      lastMessage: s.messages[0]?.content.slice(0, 100) || "",
    }));
  });

  // POST create new copilot session
  app.post("/crm-copilot/sessions", async (request) => {
    const tenantId = request.tenant.tenantId;
    const session = await prisma.crmCopilotSession.create({
      data: {
        tenantId,
        title: `Analisis CRM (${new Date().toLocaleDateString("id-ID")})`,
      },
    });

    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
    };
  });

  // GET messages for a specific session
  app.get("/crm-copilot/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenant.tenantId;

    const session = await prisma.crmCopilotSession.findFirst({
      where: { id, tenantId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return reply.code(404).send({ error: "Sesi analisis tidak ditemukan" });
    }

    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });

  // POST send prompt to copilot
  app.post("/crm-copilot/chat", async (request, reply) => {
    const tenantId = request.tenant.tenantId;
    const body = z
      .object({
        sessionId: z.string().optional(),
        prompt: z.string().min(1).max(2000),
      })
      .parse(request.body);

    let session = body.sessionId
      ? await prisma.crmCopilotSession.findFirst({
          where: { id: body.sessionId, tenantId },
          include: { messages: { orderBy: { createdAt: "asc" }, take: 10 } },
        })
      : null;

    if (!session) {
      const firstTitle = body.prompt.slice(0, 40) + "...";
      session = await prisma.crmCopilotSession.create({
        data: {
          tenantId,
          title: firstTitle,
        },
        include: { messages: true },
      });
    }

    // Save user message
    await prisma.crmCopilotMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: body.prompt,
      },
    });

    // Run AI Engine Analysis
    const chatHistory = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const analysisResult = await runCrmCopilotAnalysis({
      tenantId,
      userPrompt: body.prompt,
      chatHistory,
    });

    // Save assistant message with recommendations metadata
    const botMessage = await prisma.crmCopilotMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: analysisResult.content,
        metadata: { recommendations: analysisResult.recommendations } as any,
      },
    });

    // Touch session updatedAt
    await prisma.crmCopilotSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    return {
      sessionId: session.id,
      messageId: botMessage.id,
      role: "assistant",
      content: analysisResult.content,
      recommendations: analysisResult.recommendations,
      createdAt: botMessage.createdAt.toISOString(),
    };
  });

  // DELETE copilot session
  app.delete("/crm-copilot/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenant.tenantId;

    const session = await prisma.crmCopilotSession.findFirst({
      where: { id, tenantId },
    });

    if (!session) {
      return reply.code(404).send({ error: "Sesi tidak ditemukan" });
    }

    await prisma.crmCopilotSession.delete({ where: { id } });
    return reply.code(204).send();
  });
}
