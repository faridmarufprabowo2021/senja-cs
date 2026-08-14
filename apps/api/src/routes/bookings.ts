import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, requireTenant } from "../lib/auth.js";
import type { Booking, BookingStatus } from "@cs/shared";
import { checkBookingConflicts } from "../lib/booking-conflicts.js";
import { hub } from "../ws/hub.js";

type BookingRow = {
  id: string;
  status: BookingStatus;
  serviceName: string;
  bookingDate: Date;
  note: string;
  contactId: string;
  createdAt: Date;
  updatedAt: Date;
  contact: { name: string; phone: string };
};

function mapBooking(b: BookingRow): Booking {
  return {
    id: b.id,
    status: b.status,
    serviceName: b.serviceName,
    bookingDate: b.bookingDate.toISOString(),
    note: b.note,
    contactId: b.contactId,
    contactName: b.contact.name,
    contactPhone: b.contact.phone,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

const STATUS_ENUM = z.enum(["pending", "confirmed", "cancelled", "completed"]);

export async function bookingRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  app.get("/bookings", async (request) => {
    const q = request.query as {
      status?: string;
      from?: string;
      to?: string;
      limit?: string;
    };
    const status = q.status ? STATUS_ENUM.parse(q.status) : undefined;
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;
    const rows = await prisma.booking.findMany({
      where: {
        tenantId: request.tenant.tenantId,
        ...(status ? { status } : {}),
        ...(from || to
          ? {
              bookingDate: {
                ...(from && !isNaN(from.getTime()) ? { gte: from } : {}),
                ...(to && !isNaN(to.getTime()) ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: { contact: true },
      orderBy: { bookingDate: "asc" },
      take: Math.min(Number(q.limit) || 50, 100),
    });
    return rows.map(mapBooking);
  });

  app.get("/bookings/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await prisma.booking.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
      include: { contact: true },
    });
    if (!row) return reply.code(404).send({ error: "Not found" });
    return mapBooking(row);
  });

  app.patch("/bookings/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        status: STATUS_ENUM.optional(),
        bookingDate: z.string().datetime({ offset: true }).optional(),
        serviceName: z.string().min(1).max(160).optional(),
        note: z.string().max(1000).optional(),
      })
      .parse(request.body);

    const existing = await prisma.booking.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    // Check for conflicts only if date or service name is being changed
    let bookingDate: Date | undefined;
    if (body.bookingDate) {
      bookingDate = new Date(body.bookingDate);
      if (isNaN(bookingDate.getTime())) {
        return reply.code(400).send({ error: "Format tanggal tidak valid" });
      }

      // Check for conflicts
      const conflictResult = await checkBookingConflicts(
        request.tenant.tenantId,
        bookingDate,
        id,
        2 // 2 hours default duration
      );

      if (conflictResult.hasConflict) {
        return reply.code(409).send({
          error: "Tabrakan jadwal terdeteksi",
          conflicts: conflictResult.conflicts.map((c) => ({
            bookingId: c.bookingId,
            serviceName: c.serviceName,
            contactName: c.contactName,
            contactPhone: c.contactPhone,
            bookingDate: c.bookingDate,
            overlapMinutes: c.overlapMinutes,
            message: `Ada "${c.serviceName}" dengan ${c.contactName} (${c.contactPhone}) pada ${new Date(c.bookingDate).toLocaleString("id-ID")} (${c.overlapMinutes} menit overlap)`,
          })),
        });
      }
    }

    const row = await prisma.booking.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(bookingDate ? { bookingDate } : {}),
        ...(body.serviceName ? { serviceName: body.serviceName } : {}),
        ...(body.note != null ? { note: body.note } : {}),
      },
      include: { contact: true },
    });
    const broadcast = mapBooking(row);
    hub.toTenant(request.tenant.tenantId, "booking.updated", {
      id: broadcast.id,
      status: broadcast.status,
      bookingDate: broadcast.bookingDate,
      serviceName: broadcast.serviceName,
    });
    return broadcast;
  });

  app.delete(
    "/bookings/:id",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.booking.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "Not found" });
      await prisma.booking.delete({ where: { id } });
      hub.toTenant(request.tenant.tenantId, "booking.deleted", { id });
      return reply.code(204).send();
    },
  );

  // POST /bookings - Create Manual Booking
  app.post("/bookings", async (request, reply) => {
    const body = z
      .object({
        contactName: z.string().min(1).max(100),
        contactPhone: z.string().min(1).max(30),
        serviceName: z.string().min(1).max(160),
        bookingDate: z.string().datetime({ offset: true }),
        note: z.string().max(1000).optional(),
        status: STATUS_ENUM.default("confirmed"),
      })
      .parse(request.body);

    const bookingDate = new Date(body.bookingDate);
    if (isNaN(bookingDate.getTime())) {
      return reply.code(400).send({ error: "Format tanggal tidak valid" });
    }

    // Clean phone number & find or create contact
    let cleanPhone = body.contactPhone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.slice(1);
    const waJid = cleanPhone.endsWith("@s.whatsapp.net")
      ? cleanPhone
      : `${cleanPhone}@s.whatsapp.net`;

    let contact = await prisma.contact.findFirst({
      where: { tenantId: request.tenant.tenantId, waJid },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId: request.tenant.tenantId,
          waJid,
          name: body.contactName.trim(),
          phone: `+${cleanPhone}`,
        },
      });
    }

    // Check for scheduling conflicts
    const conflictResult = await checkBookingConflicts(
      request.tenant.tenantId,
      bookingDate,
      undefined,
      2, // 2 hours default duration
    );

    if (conflictResult.hasConflict) {
      return reply.code(409).send({
        error: "Tabrakan jadwal terdeteksi",
        conflicts: conflictResult.conflicts.map((c) => ({
          bookingId: c.bookingId,
          serviceName: c.serviceName,
          contactName: c.contactName,
          contactPhone: c.contactPhone,
          bookingDate: c.bookingDate,
          overlapMinutes: c.overlapMinutes,
          message: `Ada "${c.serviceName}" dengan ${c.contactName} (${c.contactPhone}) pada ${new Date(c.bookingDate).toLocaleString("id-ID")} (${c.overlapMinutes} menit overlap)`,
        })),
      });
    }

    const row = await prisma.booking.create({
      data: {
        tenantId: request.tenant.tenantId,
        contactId: contact.id,
        serviceName: body.serviceName.trim(),
        bookingDate,
        note: body.note?.trim() || "",
        status: body.status,
      },
      include: { contact: true },
    });

    const mapped = mapBooking(row);
    hub.toTenant(request.tenant.tenantId, "booking.updated", {
      id: mapped.id,
      status: mapped.status,
      bookingDate: mapped.bookingDate,
      serviceName: mapped.serviceName,
    });

    return reply.code(201).send(mapped);
  });

  app.get("/bookings/export-csv", async (request, reply) => {
    const bookings = await prisma.booking.findMany({
      where: { tenantId: request.tenant.tenantId },
      include: { contact: true },
      orderBy: { bookingDate: "asc" },
    });

    const header = "Layanan,Jadwal Booking,Nama Pelanggan,Nomor WA,Catatan,Status\n";
    const rows = bookings.map((b) => {
      const cleanService = `"${b.serviceName.replace(/"/g, '""')}"`;
      const cleanName = `"${b.contact.name.replace(/"/g, '""')}"`;
      const cleanNote = `"${b.note.replace(/"/g, '""')}"`;
      return `${cleanService},${b.bookingDate.toISOString()},${cleanName},${b.contact.phone},${cleanNote},${b.status}`;
    });

    const csvContent = header + rows.join("\n");
    reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", 'attachment; filename="laporan-booking.csv"')
      .send(csvContent);
  });
}
