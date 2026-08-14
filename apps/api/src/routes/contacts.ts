import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireTenant } from "../lib/auth.js";
import type { Booking, ContactDetail, ContactSummary, Order } from "@cs/shared";

export async function contactRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  app.get("/contacts", async (request) => {
    const tenantId = request.tenant.tenantId;
    const q = request.query as { tag?: string; search?: string };

    const where = {
      tenantId,
      ...(q.tag ? { tags: { has: q.tag.trim() } } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { phone: { contains: q.search } },
            ],
          }
        : {}),
    };

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    });

    const summaries: ContactSummary[] = await Promise.all(
      contacts.map(async (c) => {
        const [paidAgg, orderCount, bookingCount] = await Promise.all([
          prisma.order.aggregate({
            where: {
              tenantId,
              contactId: c.id,
              status: { in: ["paid", "done"] },
            },
            _sum: { total: true },
          }),
          prisma.order.count({ where: { tenantId, contactId: c.id } }),
          prisma.booking.count({ where: { tenantId, contactId: c.id } }),
        ]);

        return {
          id: c.id,
          waJid: c.waJid,
          phone: c.phone,
          name: c.name,
          avatarHue: c.avatarHue,
          tags: c.tags,
          totalSpent: paidAgg._sum.total || 0,
          orderCount,
          bookingCount,
          lastMessageAt: c.lastMessageAt.toISOString(),
          createdAt: c.createdAt.toISOString(),
        };
      }),
    );

    return summaries;
  });

  app.get("/contacts/:id", async (request, reply) => {
    const tenantId = request.tenant.tenantId;
    const { id } = request.params as { id: string };

    const c = await prisma.contact.findFirst({
      where: { id, tenantId },
      include: {
        orders: {
          include: { items: { include: { product: true } }, tenant: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        bookings: {
          orderBy: { bookingDate: "desc" },
          take: 20,
        },
      },
    });

    if (!c) return reply.code(404).send({ error: "Contact not found" });

    const [paidAgg, orderCount, bookingCount] = await Promise.all([
      prisma.order.aggregate({
        where: {
          tenantId,
          contactId: c.id,
          status: { in: ["paid", "done"] },
        },
        _sum: { total: true },
      }),
      prisma.order.count({ where: { tenantId, contactId: c.id } }),
      prisma.booking.count({ where: { tenantId, contactId: c.id } }),
    ]);

    const detail: ContactDetail = {
      id: c.id,
      waJid: c.waJid,
      phone: c.phone,
      name: c.name,
      avatarHue: c.avatarHue,
      tags: c.tags,
      totalSpent: paidAgg._sum.total || 0,
      orderCount,
      bookingCount,
      lastMessageAt: c.lastMessageAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
      orders: c.orders.map((o) => ({
        id: o.id,
        status: o.status as Order["status"],
        total: o.total,
        note: o.note,
        contactId: o.contactId,
        contactName: c.name,
        contactPhone: c.phone,
        items: o.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product.name,
          qty: i.qty,
          price: i.price,
        })),
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
      bookings: c.bookings.map((b) => ({
        id: b.id,
        status: b.status as Booking["status"],
        serviceName: b.serviceName,
        bookingDate: b.bookingDate.toISOString(),
        note: b.note,
        contactId: b.contactId,
        contactName: c.name,
        contactPhone: c.phone,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
    };

    return detail;
  });

  app.patch("/contacts/:id/tags", async (request, reply) => {
    const tenantId = request.tenant.tenantId;
    const { id } = request.params as { id: string };
    const body = z
      .object({
        tags: z.array(z.string().min(1).max(30)),
      })
      .parse(request.body);

    const contact = await prisma.contact.findFirst({
      where: { id, tenantId },
    });
    if (!contact) return reply.code(404).send({ error: "Contact not found" });

    const updated = await prisma.contact.update({
      where: { id },
      data: { tags: body.tags },
    });

    return {
      id: updated.id,
      name: updated.name,
      tags: updated.tags,
    };
  });
}
