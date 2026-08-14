import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { renderReminderMessage } from "../services/reminder-scheduler.js";
import { waManager } from "../wa/manager.js";

import { requireAuth, requireTenant } from "../lib/auth.js";

const ruleSchema = z.object({
  name: z.string().min(1),
  triggerType: z.enum(["UNPAID_INVOICE", "BOOKING_SCHEDULE", "CUSTOM_FOLLOWUP"]).default("UNPAID_INVOICE"),
  delayMinutes: z.number().int().min(1).default(60),
  messageTemplate: z.string().min(1),
  isActive: z.boolean().default(true),
});

export async function reminderRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  // GET /reminders - List rules & logs
  app.get("/reminders", async (request) => {
    const tenantId = request.tenant.tenantId;

    const [rules, logs] = await Promise.all([
      prisma.reminderRule.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.reminderLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    return { ok: true, rules, logs };
  });

  // POST /reminders - Create rule
  app.post("/reminders", async (request, reply) => {
    const tenantId = request.tenant.tenantId;
    const parse = ruleSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ ok: false, error: parse.error.format() });
    }

    const rule = await prisma.reminderRule.create({
      data: {
        tenantId,
        ...parse.data,
      },
    });

    return { ok: true, data: rule };
  });

  // PUT /reminders/:id - Update rule
  app.put("/reminders/:id", async (request, reply) => {
    const tenantId = request.tenant.tenantId;
    const { id } = request.params as { id: string };
    const parse = ruleSchema.partial().safeParse(request.body);

    if (!parse.success) {
      return reply.code(400).send({ ok: false, error: parse.error.format() });
    }

    const updated = await prisma.reminderRule.updateMany({
      where: { id, tenantId },
      data: parse.data,
    });

    return { ok: true, count: updated.count };
  });

  // DELETE /reminders/:id - Delete rule
  app.delete("/reminders/:id", async (request) => {
    const tenantId = request.tenant.tenantId;
    const { id } = request.params as { id: string };

    await prisma.reminderRule.deleteMany({
      where: { id, tenantId },
    });

    return { ok: true };
  });

  // POST /reminders/:id/test - Instant Test WA Send
  app.post("/reminders/:id/test", async (request, reply) => {
    const tenantId = request.tenant.tenantId;
    const { id } = request.params as { id: string };
    const { phone } = request.body as { phone: string };

    if (!phone) {
      return reply.code(400).send({ ok: false, error: "Nomor WhatsApp tujuan wajib diisi" });
    }

    const rule = await prisma.reminderRule.findFirst({
      where: { id, tenantId },
    });

    if (!rule) {
      return reply.code(404).send({ ok: false, error: "Aturan pengingat tidak ditemukan" });
    }

    const message = renderReminderMessage(rule.messageTemplate, {
      customerName: "Budi Santoso (Uji Coba)",
      invoiceNumber: "INV-DEMO88",
      amount: 150000,
      dueDate: "Besok, 18:00 WIB",
      qrisUrl: "https://midtrans.com/qris/demo",
    });

    const activeSessions = waManager.listActive(tenantId);
    let sessionId = activeSessions[0]?.sessionId;

    if (!sessionId) {
      const dbSession = await prisma.waSession.findFirst({
        where: { tenantId, status: "connected" },
      });
      if (!dbSession) {
        return reply.code(400).send({
          ok: false,
          error: "Sesi WhatsApp belum terhubung. Silakan hubungkan nomor WA di halaman WhatsApp.",
        });
      }
      sessionId = dbSession.id;
    }

    try {
      const cleanedPhone = phone.replace(/\D/g, "");
      let jid = cleanedPhone;
      if (!jid.endsWith("@s.whatsapp.net")) {
        if (jid.startsWith("0")) jid = "62" + jid.slice(1);
        jid = jid + "@s.whatsapp.net";
      }

      await waManager.sendText(sessionId, jid, message);

      await prisma.reminderLog.create({
        data: {
          tenantId,
          ruleId: rule.id,
          recipientName: "Budi Santoso (Uji Coba)",
          phone,
          message,
          status: "SENT",
          sentAt: new Date(),
        },
      });

      return { ok: true, message: "Pesan WA pengingat berhasil dikirim ke " + phone };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Gagal mengirim WA";
      await prisma.reminderLog.create({
        data: {
          tenantId,
          ruleId: rule.id,
          recipientName: "Budi Santoso (Uji Coba)",
          phone,
          message,
          status: "FAILED",
          errorMessage: errorMsg,
        },
      });
      return reply.code(500).send({ ok: false, error: errorMsg });
    }
  });
}
