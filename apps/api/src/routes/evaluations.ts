import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireTenant } from "../lib/auth.js";
import { embedText } from "../lib/embed.js";
import { createAndEmitNotification } from "../lib/notifications.js";

const createEvaluationSchema = z.object({
  conversationId: z.string(),
  messageId: z.string(),
  userQuery: z.string().min(1),
  originalBotReply: z.string(),
  correctedReply: z.string().min(1),
  rating: z.number().int().min(1).max(5).default(1),
  feedbackNote: z.string().optional(),
});

export async function evaluationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireTenant);

  // POST /api/v1/evaluations - Submit AI correction & auto-inject into RAG KB
  app.post("/evaluations", async (request, reply) => {
    const tenantId = request.tenant.tenantId;
    const body = createEvaluationSchema.parse(request.body);

    const correction = await prisma.aiCorrection.create({
      data: {
        tenantId,
        conversationId: body.conversationId,
        messageId: body.messageId,
        userQuery: body.userQuery,
        originalBotReply: body.originalBotReply,
        correctedReply: body.correctedReply,
        rating: body.rating,
        feedbackNote: body.feedbackNote || null,
        createdById: request.authUser.id,
        createdByName: request.authUser.name || "Supervisor",
      },
    });

    // Auto-create Knowledge Document & Chunk so pgvector RAG learns immediately
    const faqTitle = `Koreksi AI: ${body.userQuery.slice(0, 40)}`;
    const faqContent = `Pertanyaan/Konteks: ${body.userQuery}\nJawaban Benar (Supervisor): ${body.correctedReply}${body.feedbackNote ? `\nCatatan Tambahan: ${body.feedbackNote}` : ""}`;

    const doc = await prisma.knowledgeDocument.create({
      data: {
        tenantId,
        title: faqTitle,
        sourceType: "faq",
        status: "ready",
      },
    });

    const vec = await embedText(faqContent);
    const vectorStr = `[${vec.join(",")}]`;

    const chunk = await prisma.knowledgeChunk.create({
      data: {
        tenantId,
        documentId: doc.id,
        content: faqContent,
        embedding: vec,
      },
    });

    // Write vector to PostgreSQL pgvector column if available
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "KnowledgeChunk" SET embedding_vector = '${vectorStr}'::vector WHERE id = '${chunk.id}'`,
      );
    } catch {
      /* fallback to json embedding */
    }

    void createAndEmitNotification({
      tenantId,
      type: "system",
      title: "🧠 AI Berhasil Dipelajari!",
      message: `Supervisor ${request.authUser.name || ""} telah memperbarui jawaban AI untuk pertanyaan: "${body.userQuery.slice(0, 30)}..."`,
      link: "/knowledge",
    });

    return reply.code(201).send({
      ok: true,
      data: correction,
      knowledgeDocId: doc.id,
    });
  });

  // GET /api/v1/evaluations - List past AI evaluations & corrections
  app.get("/evaluations", async (request) => {
    const tenantId = request.tenant.tenantId;
    const list = await prisma.aiCorrection.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return { ok: true, data: list };
  });
}
