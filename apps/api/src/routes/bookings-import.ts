import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, requireTenant } from "../lib/auth.js";

export async function bookingImportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  // CSV row schema — tanggal divalidasi manual agar fleksibel (ISO / "2026-08-15 14:00")
  const csvRowSchema = z.object({
    serviceName: z.string().min(1).max(160),
    contactName: z.string().min(1),
    contactPhone: z.string().regex(/^\+?[0-9\s\-]+$/),
    bookingDate: z.string().min(1),
    note: z.string().max(500).optional().default(""),
    status: z.enum(["pending", "confirmed"]).default("pending"),
  });

  app.post("/bookings/import", {
    preHandler: [requireRole("owner", "admin")],
  }, async (request, reply) => {
    const file = await (request as any).file();

    if (!file || !String(file.mimetype ?? "").includes("csv")) {
      return reply.code(400).send({ error: "Upload hanya menerima file CSV" });
    }

    let fileContent: string;
    try {
      const buf = await file.toBuffer();
      fileContent = buf.toString("utf-8").replace(/^\uFEFF/, ""); // strip BOM
    } catch {
      return reply.code(400).send({ error: "File terlalu besar atau gagal dibaca" });
    }

    const rows = parseCSV(fileContent);

    if (rows.length === 0) {
      return reply.code(400).send({ error: "File CSV kosong atau format tidak valid" });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; reason: string }>,
    };

    let rowNumber = 1; // 1-based, header = baris 1
    for (const row of rows) {
      rowNumber++;
      try {
        const validated = csvRowSchema.parse(row);

        const bookingDate = new Date(validated.bookingDate);
        if (isNaN(bookingDate.getTime())) {
          throw new Error(`Format tanggal tidak valid: "${validated.bookingDate}"`);
        }

        // Cari kontak berdasarkan nomor (normalisasi tanpa spasi)
        const normalizedPhone = validated.contactPhone.replace(/[\s\-]/g, "");
        let contact = await prisma.contact.findFirst({
          where: {
            tenantId: request.tenant.tenantId,
            OR: [
              { phone: normalizedPhone },
              { phone: `+${normalizedPhone}` },
              { phone: validated.contactPhone },
            ],
          },
        });

        if (!contact) {
          const digits = normalizedPhone.replace(/^\+/, "");
          contact = await prisma.contact.create({
            data: {
              tenantId: request.tenant.tenantId,
              name: validated.contactName,
              phone: normalizedPhone,
              waJid: `${digits.startsWith("0") ? "62" + digits.slice(1) : digits.startsWith("62") ? digits : "62" + digits}@s.whatsapp.net`,
            },
          });
        }

        await prisma.booking.create({
          data: {
            tenantId: request.tenant.tenantId,
            contactId: contact.id,
            serviceName: validated.serviceName,
            bookingDate,
            note: validated.note ?? "",
            status: validated.status,
          },
        });

        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          reason: err?.issues?.[0]?.message ?? err.message ?? "Unknown validation error",
        });
      }
    }

    return { ok: true, results };
  });
}

/** CSV parser sederhana: auto-detect delimiter (`,` atau `;`), support tanda kutip. */
export function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  // Auto-detect delimiter dari header
  const headerLine = lines[0];
  const delimiter =
    (headerLine.match(/;/g)?.length ?? 0) > (headerLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };

  const headers = splitLine(headerLine).filter((h) => h);
  if (headers.length === 0) return [];

  return lines
    .slice(1)
    .map((line) => {
      const values = splitLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] ?? "";
      });
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => v.length > 0));
}
