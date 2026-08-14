import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, requireTenant } from "../lib/auth.js";
import { ingestDocument, reindexDocument } from "../bot/ingest.js";
import { retrieveChunks } from "../bot/retrieve.js";

function mapDoc(d: {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  chunkCount: number;
  updatedAt: Date;
  fileUrl?: string | null;
  imageUrl?: string | null;
  imageName?: string | null;
  imageCaption?: string | null;
  error?: string | null;
}) {
  return {
    id: d.id,
    title: d.title,
    sourceType: d.sourceType as "pdf" | "txt" | "md" | "faq" | "image",
    status: d.status as "processing" | "ready" | "failed",
    chunkCount: d.chunkCount,
    fileUrl: d.fileUrl ?? undefined,
    imageUrl: d.imageUrl ?? d.fileUrl ?? undefined,
    imageName: d.imageName ?? d.title,
    imageCaption: d.imageCaption ?? undefined,
    updatedAt: d.updatedAt.toISOString(),
    error: d.error ?? undefined,
  };
}

export async function knowledgeRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  app.get("/knowledge/documents", async (request) => {
    const docs = await prisma.knowledgeDocument.findMany({
      where: { tenantId: request.tenant.tenantId },
      orderBy: { updatedAt: "desc" },
    });
    return docs.map(mapDoc);
  });

  app.get("/knowledge/documents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await prisma.knowledgeDocument.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
    });
    if (!doc) return reply.code(404).send({ error: "Dokumen tidak ditemukan" });

    const chunks = await prisma.knowledgeChunk.findMany({
      where: { documentId: id, tenantId: request.tenant.tenantId },
      orderBy: { createdAt: "asc" },
    });

    const fullContent = chunks.map((c) => c.content).join("\n\n");

    return {
      ...mapDoc(doc),
      content: fullContent,
      chunks: chunks.map((c, idx) => ({
        id: c.id,
        chunkIndex: idx + 1,
        content: c.content,
      })),
    };
  });

  app.post(
    "/knowledge/documents",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const body = z
        .object({
          title: z.string().min(1).max(200),
          content: z.string().min(1).max(200_000),
          sourceType: z.enum(["pdf", "txt", "md", "faq"]).default("txt"),
        })
        .parse(request.body);

      const doc = await prisma.knowledgeDocument.create({
        data: {
          tenantId: request.tenant.tenantId,
          title: body.title,
          sourceType: body.sourceType,
          status: "processing",
        },
      });

      void ingestDocument(doc.id, body.content).catch((err) => {
        request.log.error(err);
      });

      return reply.code(201).send(mapDoc(doc));
    },
  );

  app.post(
    "/knowledge/faq",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const body = z
        .object({
          question: z.string().min(1),
          answer: z.string().min(1),
        })
        .parse(request.body);

      const content = `Q: ${body.question}\nA: ${body.answer}`;
      const doc = await prisma.knowledgeDocument.create({
        data: {
          tenantId: request.tenant.tenantId,
          title: body.question.slice(0, 80),
          sourceType: "faq",
          status: "processing",
        },
      });
      await ingestDocument(doc.id, content);
      const ready = await prisma.knowledgeDocument.findUniqueOrThrow({
        where: { id: doc.id },
      });
      return reply.code(201).send(mapDoc(ready));
    },
  );

  app.post(
    "/knowledge/image",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const body = z
        .object({
          imageName: z.string().min(1).max(100),
          imageUrl: z.string().url(),
          imageCaption: z.string().max(1000).optional(),
          aiAgentId: z.string().optional(),
        })
        .parse(request.body);

      const captionText = body.imageCaption || `Foto/Gambar ${body.imageName}`;
      const content = `[FOTO/GAMBAR KNOWLEDGE BASE: ${body.imageName}]
Nama Foto/Brosur: ${body.imageName}
Keterangan Foto: ${captionText}
URL Foto: ${body.imageUrl}

PETUNJUK AI: Jika pelanggan meminta foto, brosur, denah, atau gambar tentang "${body.imageName}", informasikan ketersediaannya dan lampirkan URL foto berikut: [Foto: ${body.imageUrl}]!`;

      const doc = await prisma.knowledgeDocument.create({
        data: {
          tenantId: request.tenant.tenantId,
          aiAgentId: body.aiAgentId || null,
          title: `🖼️ ${body.imageName}`,
          sourceType: "image",
          status: "processing",
          imageUrl: body.imageUrl,
          fileUrl: body.imageUrl,
          imageName: body.imageName,
          imageCaption: captionText,
        },
      });

      await ingestDocument(doc.id, content);
      const ready = await prisma.knowledgeDocument.findUniqueOrThrow({
        where: { id: doc.id },
      });
      return reply.code(201).send(mapDoc(ready));
    },
  );

  app.delete(
    "/knowledge/documents/:id",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const doc = await prisma.knowledgeDocument.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!doc) return reply.code(404).send({ error: "Not found" });
      await prisma.knowledgeDocument.delete({ where: { id } });
      return reply.code(204).send();
    },
  );

  app.post(
    "/knowledge/documents/:id/reindex",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const doc = await prisma.knowledgeDocument.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!doc) return reply.code(404).send({ error: "Not found" });
      await reindexDocument(id);
      const ready = await prisma.knowledgeDocument.findUniqueOrThrow({
        where: { id },
      });
      return mapDoc(ready);
    },
  );

  app.post(
    "/knowledge/documents/:id/extract-catalog",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const doc = await prisma.knowledgeDocument.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!doc) return reply.code(404).send({ error: "Not found" });

      const chunks = await prisma.knowledgeChunk.findMany({
        where: { documentId: id, tenantId: request.tenant.tenantId },
      });
      const fullContent = chunks.map((c) => c.content).join("\n\n");
      const { extractCatalogFromContent } = await import("../bot/ingest.js");
      const count = await extractCatalogFromContent(request.tenant.tenantId, fullContent);
      return { ok: true, message: `Berhasil mengekstrak & menyinkronkan ${count} item katalog produk/jasa ke database!`, count };
    },
  );

  app.post("/knowledge/query", async (request) => {
    const body = z
      .object({
        query: z.string().min(1),
        topK: z.number().int().min(1).max(20).optional(),
      })
      .parse(request.body);
    const chunks = await retrieveChunks(
      request.tenant.tenantId,
      body.query,
      body.topK ?? 5,
    );
    return { chunks };
  });

  /**
   * GET /knowledge/media - List all PDF and Image documents for Media Picker
   */
  app.get("/knowledge/media", async (request) => {
    const docs = await prisma.knowledgeDocument.findMany({
      where: {
        tenantId: request.tenant.tenantId,
        OR: [
          { sourceType: "pdf" },
          { sourceType: "image" },
          { fileUrl: { not: null } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      sourceType: d.sourceType,
      fileUrl: d.fileUrl || `/api/v1/media/${d.storageKey || d.id}`,
      updatedAt: d.updatedAt.toISOString(),
    }));
  });

  /**
   * POST /knowledge/upload-media - Upload PDF/Image media file directly
   */
  app.post(
    "/knowledge/upload-media",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: "File tidak ditemukan" });
      }

      const pathMod = await import("node:path");
      const fs = await import("node:fs");
      const { env } = await import("../lib/env.js");

      if (!fs.existsSync(env.STORAGE_LOCAL_PATH)) {
        fs.mkdirSync(env.STORAGE_LOCAL_PATH, { recursive: true });
      }

      const ext = pathMod.extname(data.filename).toLowerCase();
      const isPdf = ext === ".pdf";
      const isImage = [".png", ".jpg", ".jpeg", ".webp"].includes(ext);

      if (!isPdf && !isImage) {
        return reply.code(400).send({ error: "Format file harus berupa PDF, PNG, JPG, JPEG, atau WEBP" });
      }

      const safeFilename = `${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = pathMod.join(env.STORAGE_LOCAL_PATH, safeFilename);

      const buffer = await data.toBuffer();
      fs.writeFileSync(filePath, buffer);

      const publicUrl = `http://localhost:4000/api/v1/media/${safeFilename}`;
      const sourceType = isPdf ? "pdf" : "image";

      const doc = await prisma.knowledgeDocument.create({
        data: {
          tenantId: request.tenant.tenantId,
          title: data.filename,
          sourceType,
          status: "ready",
          storageKey: safeFilename,
          fileUrl: publicUrl,
        },
      });

      // If PDF, also extract text for AI RAG Knowledge search!
      if (isPdf) {
        try {
          const pdfParse = (await import("pdf-parse" as any)).default;
          const parsed = await pdfParse(buffer);
          if (parsed.text && parsed.text.trim().length > 0) {
            await ingestDocument(doc.id, parsed.text);
          }
        } catch {
          /* ignore pdf text extraction errors, keep fileUrl intact */
        }
      }

      return {
        ok: true,
        document: {
          id: doc.id,
          title: doc.title,
          sourceType: doc.sourceType,
          fileUrl: publicUrl,
        },
      };
    },
  );
}
