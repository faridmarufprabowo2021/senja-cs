import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireTenant } from "../lib/auth.js";

export async function followupAnalyticsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  app.get("/analytics/followup-performance", async (request) => {
    const tenantId = request.tenant.tenantId;

    // Total follow-up messages sent
    const stage1Sent = await prisma.conversation.count({
      where: { tenantId, followupStageCount: { gte: 1 } },
    });
    const stage2Sent = await prisma.conversation.count({
      where: { tenantId, followupStageCount: { gte: 2 } },
    });

    // Total conversions (customer replied or completed booking after follow-up)
    const convertedConvs = await prisma.conversation.findMany({
      where: {
        tenantId,
        followupConvertedAt: { not: null },
      },
      include: {
        contact: {
          include: {
            orders: { select: { total: true } },
            bookings: { select: { id: true } },
          },
        },
      },
    });

    const totalConverted = convertedConvs.length;
    const conversionRate = stage1Sent > 0 ? Math.min(100, Math.round((totalConverted / stage1Sent) * 100)) : 0;

    // Estimate recovered revenue (sum of order totals & bookings associated with converted contacts)
    let recoveredRevenue = 0;
    for (const c of convertedConvs) {
      if (c.contact?.orders) {
        for (const order of c.contact.orders) {
          recoveredRevenue += order.total || 0;
        }
      }
      // Add estimated booking value if no order (e.g. Rp 150.000 per booking)
      if (c.contact?.bookings && c.contact.bookings.length > 0 && (!c.contact.orders || c.contact.orders.length === 0)) {
        recoveredRevenue += c.contact.bookings.length * 150000;
      }
    }

    return {
      totalFollowupsSent: stage1Sent + stage2Sent,
      stage1Sent,
      stage2Sent,
      totalConverted,
      conversionRate,
      recoveredRevenue,
    };
  });
}
