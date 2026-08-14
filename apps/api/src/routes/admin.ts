import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireSuperAdmin } from "../lib/auth.js";

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireSuperAdmin(request, reply);
  });

  // GET /admin/metrics - Global Platform Metrics & MRR
  app.get("/admin/metrics", async () => {
    const now = new Date();

    const [
      totalTenants,
      proTenants,
      enterpriseTenants,
      starterTenants,
      expiredTenants,
      paidSubscriptions,
      totalOrders,
      totalMessages,
      activeWaSessions,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { plan: "pro" } }),
      prisma.tenant.count({ where: { plan: "enterprise" } }),
      prisma.tenant.count({ where: { plan: "starter" } }),
      prisma.tenant.count({
        where: {
          planExpiresAt: { lt: now },
        },
      }),
      prisma.subscriptionTransaction.aggregate({
        where: { status: "paid" },
        _sum: { amount: true },
      }),
      prisma.order.count(),
      prisma.message.count(),
      prisma.waSession.count({ where: { status: "connected" } }),
    ]);

    return {
      totalTenants,
      mrrRevenue: paidSubscriptions._sum.amount || 0,
      planBreakdown: {
        starter: starterTenants,
        pro: proTenants,
        enterprise: enterpriseTenants,
        expired: expiredTenants,
      },
      totalOrders,
      totalMessages,
      activeWaSessions,
    };
  });

  // GET /admin/tenants - Searchable & Filterable Tenant List
  app.get("/admin/tenants", async (request) => {
    const q = request.query as { search?: string; plan?: string; limit?: string };
    const search = q.search?.trim();
    const limit = Math.min(Number(q.limit) || 50, 100);

    const where: any = {};
    if (q.plan) {
      where.plan = q.plan;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        members: {
          where: { role: "owner" },
          include: { user: true },
          take: 1,
        },
        waSessions: {
          select: { id: true, status: true, phoneE164: true, engine: true },
        },
        _count: {
          select: { members: true, orders: true, contacts: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const now = new Date();

    return tenants.map((t) => {
      const owner = t.members[0]?.user;
      const expiresAt = t.planExpiresAt;
      const isExpired = Boolean(expiresAt && expiresAt.getTime() < now.getTime());

      let daysRemaining = 0;
      if (expiresAt && !isExpired) {
        daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        planExpiresAt: expiresAt ? expiresAt.toISOString() : null,
        isExpired,
        daysRemaining,
        vertical: t.vertical,
        owner: owner
          ? {
              id: owner.id,
              name: owner.name,
              email: owner.email,
            }
          : null,
        waSessions: t.waSessions,
        stats: {
          members: t._count.members,
          orders: t._count.orders,
          contacts: t._count.contacts,
        },
        createdAt: t.createdAt.toISOString(),
      };
    });
  });

  // PATCH /admin/tenants/:id - Super Admin Override (Grant Plan / Add Trial Days)
  app.patch("/admin/tenants/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        plan: z.enum(["starter", "pro", "enterprise"]).optional(),
        addDays: z.number().int().min(1).max(365).optional(),
        planExpiresAt: z.string().datetime().optional(),
      })
      .parse(request.body);

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

    const now = new Date();
    let nextExpiresAt = tenant.planExpiresAt;

    if (body.addDays) {
      const base = nextExpiresAt && nextExpiresAt.getTime() > now.getTime() ? nextExpiresAt : now;
      nextExpiresAt = new Date(base.getTime() + body.addDays * 24 * 60 * 60 * 1000);
    } else if (body.planExpiresAt) {
      nextExpiresAt = new Date(body.planExpiresAt);
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        ...(body.plan ? { plan: body.plan } : {}),
        ...(nextExpiresAt ? { planExpiresAt: nextExpiresAt } : {}),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      plan: updated.plan,
      planExpiresAt: updated.planExpiresAt ? updated.planExpiresAt.toISOString() : null,
      message: "Tenant plan updated successfully",
    };
  });

  // GET /admin/transactions - Platform-wide Subscription Transactions Log
  app.get("/admin/transactions", async (request) => {
    const transactions = await prisma.subscriptionTransaction.findMany({
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return transactions.map((tx) => ({
      id: tx.id,
      tenantId: tx.tenantId,
      tenantName: tx.tenant.name,
      tenantSlug: tx.tenant.slug,
      plan: tx.plan,
      amount: tx.amount,
      status: tx.status,
      snapRedirectUrl: tx.snapRedirectUrl,
      createdAt: tx.createdAt.toISOString(),
      paidAt: tx.paidAt ? tx.paidAt.toISOString() : null,
    }));
  });

  // GET /admin/wa-monitor - Live WhatsApp Engine Sessions Status
  app.get("/admin/wa-monitor", async () => {
    const sessions = await prisma.waSession.findMany({
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return sessions.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      tenantName: s.tenant.name,
      engineType: s.engine,
      status: s.status,
      phone: s.phoneE164,
      updatedAt: s.updatedAt.toISOString(),
    }));
  });
}
