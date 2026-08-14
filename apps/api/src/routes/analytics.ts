import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireTenant } from "../lib/auth.js";
import { analyzeConversation, generateTenantExecutiveInsights } from "../bot/analytics.js";

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireTenant);

  // 1. GET /api/v1/analytics/overview - Overall KPI Metrics & Breakdown
  app.get("/overview", async (request) => {
    const tenantId = request.tenant.tenantId;

    // Auto analyze any unanalyzed conversations that have at least 2 messages
    const unanalyzed = await prisma.conversation.findMany({
      where: {
        tenantId,
        analytics: { is: null },
      },
      select: { id: true },
      take: 10,
    });

    for (const c of unanalyzed) {
      await analyzeConversation(c.id).catch(() => {});
    }

    const allAnalytics = await prisma.conversationAnalytics.findMany({
      where: { tenantId },
    });

    const totalAnalyzed = allAnalytics.length;
    const positiveCount = allAnalytics.filter((a) => a.sentiment === "positive").length;
    const neutralCount = allAnalytics.filter((a) => a.sentiment === "neutral").length;
    const negativeCount = allAnalytics.filter((a) => a.sentiment === "negative").length;

    const csatPercentage = totalAnalyzed > 0 ? Math.round((positiveCount / totalAnalyzed) * 100) : 100;
    const convertedCount = allAnalytics.filter((a) => a.isConverted).length;
    const conversionRate = totalAnalyzed > 0 ? Math.round((convertedCount / totalAnalyzed) * 100) : 0;
    const analyticsRevenue = allAnalytics.reduce((acc, a) => acc + a.revenue, 0);

    // Compute real revenue from Paid Orders in database
    const totalOrderRev = await prisma.order.aggregate({
      where: { tenantId, status: "paid" as any },
      _sum: { total: true },
    });
    const realTotalRevenue = (totalOrderRev._sum.total || 0) + analyticsRevenue;

    // Build real 7-day daily trend from DB records
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [realPaidOrders, recentMessages] = await Promise.all([
      prisma.order.findMany({
        where: { tenantId, status: "paid" as any, createdAt: { gte: sevenDaysAgo } },
        select: { total: true, createdAt: true },
      }),
      prisma.message.findMany({
        where: { tenantId, direction: "in", createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
    ]);

    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = dayNames[d.getDay()];

      const dayOrders = realPaidOrders.filter((ord) => ord.createdAt.toISOString().split("T")[0] === dateStr);
      const dayMessages = recentMessages.filter((m) => m.createdAt.toISOString().split("T")[0] === dateStr);

      const dayRev = dayOrders.reduce((acc: number, ord: { total: number }) => acc + ord.total, 0);

      dailyTrend.push({
        date: dateStr,
        day: dayName,
        revenue: dayRev,
        chats: dayMessages.length,
      });
    }

    const intentBreakdown = {
      inquiry: allAnalytics.filter((a) => a.intentCategory === "inquiry").length,
      booking: allAnalytics.filter((a) => a.intentCategory === "booking").length,
      order: allAnalytics.filter((a) => a.intentCategory === "order").length,
      complaint: allAnalytics.filter((a) => a.intentCategory === "complaint").length,
      support: allAnalytics.filter((a) => a.intentCategory === "support").length,
    };

    return {
      ok: true,
      totalAnalyzed,
      csatPercentage,
      totalRevenue: realTotalRevenue,
      conversionRate,
      complaintCount: negativeCount,
      sentimentBreakdown: {
        positive: positiveCount,
        neutral: neutralCount,
        negative: negativeCount,
      },
      intentBreakdown,
      dailyTrend,
    };
  });

  // 2. GET /api/v1/analytics/conversations - Analyzed conversations list with contact info & summaries
  app.get("/conversations", async (request) => {
    const tenantId = request.tenant.tenantId;

    const list = await prisma.conversationAnalytics.findMany({
      where: { tenantId },
      include: {
        conversation: {
          include: {
            contact: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return {
      ok: true,
      data: list.map((a) => ({
        id: a.id,
        conversationId: a.conversationId,
        contactName: a.conversation.contact.name,
        contactPhone: a.conversation.contact.phone,
        sentiment: a.sentiment,
        sentimentScore: a.sentimentScore,
        intentCategory: a.intentCategory,
        summary: a.summary,
        isConverted: a.isConverted,
        revenue: a.revenue,
        updatedAt: a.updatedAt,
      })),
    };
  });

  // 3. POST /api/v1/analytics/analyze/:id - Manually trigger / refresh analysis
  app.post("/analyze/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = await analyzeConversation(id);
    if (!record) return reply.code(400).send({ error: "Gagal memproses analisis percakapan" });
    return { ok: true, data: record };
  });

  // 4. GET /api/v1/analytics/insights - AI Key Insights, Recommendations, and Top FAQ Intelligence
  app.get("/insights", async (request) => {
    const tenantId = request.tenant.tenantId;
    const data = await generateTenantExecutiveInsights(tenantId);
    return { ok: true, data };
  });

  // 5. POST /api/v1/analytics/insights/regenerate - Trigger fresh LLM executive report generation
  app.post("/insights/regenerate", async (request) => {
    const tenantId = request.tenant.tenantId;
    const data = await generateTenantExecutiveInsights(tenantId);
    return { ok: true, data };
  });
}
