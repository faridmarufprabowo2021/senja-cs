import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireTenant } from "../lib/auth.js";

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  // GET /api/v1/notifications — List latest 20 notifications and unread count
  app.get("/notifications", async (request) => {
    const tenantId = request.tenant.tenantId;

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.notification.count({
        where: { tenantId, isRead: false },
      }),
    ]);

    return {
      items,
      unreadCount,
    };
  });

  // PATCH /api/v1/notifications/:id/read — Mark single notification as read
  app.patch("/notifications/:id/read", async (request) => {
    const tenantId = request.tenant.tenantId;
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const updated = await prisma.notification.updateMany({
      where: { id, tenantId },
      data: { isRead: true },
    });

    return { success: true, count: updated.count };
  });

  // PATCH /api/v1/notifications/read-all — Mark all tenant notifications as read
  app.patch("/notifications/read-all", async (request) => {
    const tenantId = request.tenant.tenantId;

    const updated = await prisma.notification.updateMany({
      where: { tenantId, isRead: false },
      data: { isRead: true },
    });

    return { success: true, count: updated.count };
  });
}
