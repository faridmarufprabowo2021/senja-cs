import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, requireTenant } from "../lib/auth.js";
import { z } from "zod";
import { invalidateBotSettingsCache } from "../lib/bot-settings-cache.js";

export async function reminderSettingsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  /**
   * GET reminder settings for current tenant
   */
  app.get("/reminder-settings", async (request) => {
    const settings = await prisma.botSettings.findUnique({
      where: { tenantId: request.tenant.tenantId },
      select: {
        reminderEnabled: true,
        reminderWindowStartHours: true,
        reminderWindowEndHours: true,
        reminderTemplate: true,
      },
    });

    return (
      settings ?? {
        reminderEnabled: true,
        reminderWindowStartHours: 30,
        reminderWindowEndHours: 18,
        reminderTemplate: `⏰ *Pengingat Jadwal Reservasi*

Halo *{name}*,
Sekadar mengingatkan jadwal reservasi *{service}* Anda pada *{date}* besok.

📌 *Catatan*: Mohon hadir 15 menit sebelum jam tindakan.
Jika ada perubahan jadwal, silakan balas chat ini ya. Terima kasih! 🙏`,
      }
    );
  });

  /**
   * PATCH update reminder settings
   */
  app.patch(
    "/reminder-settings",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const body = z
        .object({
          reminderEnabled: z.boolean().optional(),
          reminderWindowStartHours: z.number().int().min(1).max(72).optional(),
          reminderWindowEndHours: z.number().int().min(1).max(72).optional(),
          reminderTemplate: z.string().max(1000).optional(),
        })
        .parse(request.body);

      const updated = await prisma.botSettings.upsert({
        where: { tenantId: request.tenant.tenantId },
        create: {
          tenantId: request.tenant.tenantId,
          enabled: true,
          reminderEnabled: true as any,
          reminderWindowStartHours: 30,
          reminderWindowEndHours: 18,
          reminderTemplate: `⏰ *Pengingat Jadwal Reservasi*

Halo *{name}*,
Sekadar mengingatkan jadwal reservasi *{service}* Anda pada *{date}* besok.

📌 *Catatan*: Mohon hadir 15 menit sebelum jam tindakan.
Jika ada perubahan jadwal, silakan balas chat ini ya. Terima kasih! 🙏`,
        },
        update: body,
        select: {
          reminderEnabled: true as any,
          reminderWindowStartHours: true as any,
          reminderWindowEndHours: true as any,
          reminderTemplate: true as any,
        } satisfies {
          reminderEnabled?: boolean;
          reminderWindowStartHours?: number;
          reminderWindowEndHours?: number;
          reminderTemplate?: string;
        },
      });

      invalidateBotSettingsCache(request.tenant.tenantId);

      return { ok: true, data: updated };
    },
  );
}
