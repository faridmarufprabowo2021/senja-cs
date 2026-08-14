import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireTenant, requireRole } from "../lib/auth.js";
import { mapWaSession } from "../lib/mappers.js";
import { waManager } from "../wa/manager.js";

export async function waRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    if (request.url.includes("/openwa-webhook")) return;
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  app.get("/wa/sessions", async (request) => {
    const sessions = await prisma.waSession.findMany({
      where: { tenantId: request.tenant.tenantId },
      orderBy: { createdAt: "desc" },
    });
    return sessions.map(mapWaSession);
  });

  app.post(
    "/wa/sessions",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const body = z
        .object({
          label: z.string().min(1).default("WhatsApp Utama"),
          engine: z.enum(["baileys", "openwa"]).default("baileys"),
        })
        .parse(request.body ?? {});

      const session = await prisma.waSession.create({
        data: {
          tenantId: request.tenant.tenantId,
          label: body.label,
          engine: body.engine,
          status: "pending",
        },
      });

      await waManager.start(request.tenant.tenantId, session.id, {
        engine: body.engine,
      });
      const fresh = await prisma.waSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      return reply.code(201).send(mapWaSession(fresh));
    },
  );

  app.get("/wa/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await prisma.waSession.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
    });
    if (!session) return reply.code(404).send({ error: "Not found" });
    const runtime = waManager.get(id);
    return {
      ...mapWaSession(session),
      qr: runtime?.qr,
    };
  });

  app.get("/wa/sessions/:id/qr", async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await prisma.waSession.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
    });
    if (!session) return reply.code(404).send({ error: "Not found" });
    const runtime = waManager.get(id);
    return { sessionId: id, qr: runtime?.qr ?? null, status: session.status };
  });

  app.post(
    "/wa/sessions/:id/connect",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          force: z.boolean().optional(),
          forceQr: z.boolean().optional(),
          engine: z.enum(["baileys", "openwa"]).optional(),
        })
        .parse(request.body ?? {});
      const session = await prisma.waSession.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!session) return reply.code(404).send({ error: "Not found" });

      const targetEngine = body.engine || session.engine;

      if (body.engine && body.engine !== session.engine) {
        await prisma.waSession.update({
          where: { id },
          data: { engine: body.engine },
        });
      }

      // force / forceQr → wipe auth + new QR.
      // disconnected without force → still force QR (stale pairing).
      // pending/qr without force → restart socket without wiping mid-scan auth if present.
      const forceQr =
        body.force === true ||
        body.forceQr === true ||
        session.status === "disconnected" ||
        (!!body.engine && body.engine !== session.engine);

      request.log.info(
        { sessionId: id, forceQr, status: session.status, engine: targetEngine },
        "wa connect",
      );
      await waManager.start(request.tenant.tenantId, id, {
        forceQr,
        engine: targetEngine as "baileys" | "openwa",
      });
      const fresh = await prisma.waSession.findUniqueOrThrow({ where: { id } });
      const runtime = waManager.get(id);
      const dynamicQr = runtime?.driver && "getQr" in runtime.driver ? await (runtime.driver as any).getQr() : runtime?.qr ?? null;
      return {
        ok: true,
        ...mapWaSession(fresh),
        qr: dynamicQr || runtime?.qr || null,
      };
    },
  );

  app.post(
    "/wa/sessions/:id/disconnect",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const session = await prisma.waSession.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!session) return reply.code(404).send({ error: "Not found" });
      const updated = await waManager.stop(id, false);
      request.log.info({ sessionId: id }, "wa disconnect");
      return mapWaSession(updated);
    },
  );

  app.delete(
    "/wa/sessions/:id",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const session = await prisma.waSession.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!session) return reply.code(404).send({ error: "Not found" });
      await waManager.stop(id, true);
      await prisma.waSession.delete({ where: { id } });
      return reply.code(204).send();
    },
  );

  app.post("/wa/openwa-webhook", async (request, reply) => {
    const payload = request.body as any;
    const sessionId = payload?.sessionId || payload?.session;
    if (!sessionId) {
      return reply.code(400).send({ error: "Missing sessionId in webhook" });
    }
    const session = await prisma.waSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return reply.code(404).send({ error: "Session not found" });
    }
    if (payload.data) {
      await waManager.handleInbound(session.tenantId, sessionId, payload.data);
    }
    return { ok: true };
  });
}
