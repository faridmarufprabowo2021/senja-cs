import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, requireTenant } from "../lib/auth.js";
import { sendOrderInvoiceWa } from "../lib/order-invoice-send.js";
import { chatComplete } from "../lib/llm.js";
import { createAndEmitNotification } from "../lib/notifications.js";
import { analyzeConversationForContact } from "../bot/analytics.js";

function mapProduct(p: {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number | null;
  unit: string;
  active: boolean;
  imageUrl: string | null;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    unit: p.unit,
    active: p.active,
    imageUrl: p.imageUrl,
    updatedAt: p.updatedAt.toISOString(),
  };
}

function mapOrder(o: {
  id: string;
  status: OrderStatus;
  total: number;
  note: string;
  contactId: string;
  createdAt: Date;
  updatedAt: Date;
  contact: { name: string; phone: string };
  items: {
    id: string;
    productId: string;
    qty: number;
    price: number;
    product: { name: string };
  }[];
}) {
  return {
    id: o.id,
    status: o.status,
    total: o.total,
    note: o.note,
    contactId: o.contactId,
    contactName: o.contact.name,
    contactPhone: o.contact.phone,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      qty: i.qty,
      price: i.price,
    })),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

export async function commerceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  // —— Workspace vertical + B1 payment ——
  app.get("/workspace", async (request) => {
    const t = await prisma.tenant.findUniqueOrThrow({
      where: { id: request.tenant.tenantId },
    });
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      vertical: t.vertical,
      payBank: t.payBank,
      payAccount: t.payAccount,
      payAccountName: t.payAccountName,
      payNote: t.payNote,
      invoiceHeader: t.invoiceHeader || "",
      invoiceFooter: t.invoiceFooter || "",
      receiptHeader: t.receiptHeader || "",
      receiptFooter: t.receiptFooter || "",
      invoiceCustomTemplate: t.invoiceCustomTemplate || "",
      receiptCustomTemplate: t.receiptCustomTemplate || "",
      useCustomInvoiceTemplate: t.useCustomInvoiceTemplate ?? false,
      midtransServerKey: t.midtransServerKey,
      midtransClientKey: t.midtransClientKey,
      midtransMerchantId: t.midtransMerchantId,
      midtransIsProduction: t.midtransIsProduction,
    };
  });

  app.patch(
    "/workspace",
    { preHandler: [requireRole("owner", "admin")] },
    async (request) => {
      const body = z
        .object({
          name: z.string().min(1).max(120).optional(),
          vertical: z.enum(["commerce", "booking"]).optional(),
          payBank: z.string().max(80).optional(),
          payAccount: z.string().max(80).optional(),
          payAccountName: z.string().max(120).optional(),
          payNote: z.string().max(1000).optional(),
          invoiceHeader: z.string().max(300).optional(),
          invoiceFooter: z.string().max(500).optional(),
          receiptHeader: z.string().max(300).optional(),
          receiptFooter: z.string().max(500).optional(),
          invoiceCustomTemplate: z.string().max(4000).optional(),
          receiptCustomTemplate: z.string().max(4000).optional(),
          useCustomInvoiceTemplate: z.boolean().optional(),
          midtransServerKey: z.string().max(200).optional(),
          midtransClientKey: z.string().max(200).optional(),
          midtransMerchantId: z.string().max(200).optional(),
          midtransIsProduction: z.boolean().optional(),
        })
        .parse(request.body);
      const t = await prisma.tenant.update({
        where: { id: request.tenant.tenantId },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.vertical ? { vertical: body.vertical } : {}),
          ...(body.payBank != null ? { payBank: body.payBank } : {}),
          ...(body.payAccount != null ? { payAccount: body.payAccount } : {}),
          ...(body.payAccountName != null
            ? { payAccountName: body.payAccountName }
            : {}),
          ...(body.payNote != null ? { payNote: body.payNote } : {}),
          ...(body.invoiceHeader != null ? { invoiceHeader: body.invoiceHeader } : {}),
          ...(body.invoiceFooter != null ? { invoiceFooter: body.invoiceFooter } : {}),
          ...(body.receiptHeader != null ? { receiptHeader: body.receiptHeader } : {}),
          ...(body.receiptFooter != null ? { receiptFooter: body.receiptFooter } : {}),
          ...(body.invoiceCustomTemplate != null ? { invoiceCustomTemplate: body.invoiceCustomTemplate } : {}),
          ...(body.receiptCustomTemplate != null ? { receiptCustomTemplate: body.receiptCustomTemplate } : {}),
          ...(body.useCustomInvoiceTemplate != null ? { useCustomInvoiceTemplate: body.useCustomInvoiceTemplate } : {}),
          ...(body.midtransServerKey != null
            ? { midtransServerKey: body.midtransServerKey }
            : {}),
          ...(body.midtransClientKey != null
            ? { midtransClientKey: body.midtransClientKey }
            : {}),
          ...(body.midtransMerchantId != null
            ? { midtransMerchantId: body.midtransMerchantId }
            : {}),
          ...(body.midtransIsProduction != null
            ? { midtransIsProduction: body.midtransIsProduction }
            : {}),
        },
      });
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        vertical: t.vertical,
        payBank: t.payBank,
        payAccount: t.payAccount,
        payAccountName: t.payAccountName,
        payNote: t.payNote,
        invoiceHeader: t.invoiceHeader,
        invoiceFooter: t.invoiceFooter,
        receiptHeader: t.receiptHeader,
        receiptFooter: t.receiptFooter,
        invoiceCustomTemplate: t.invoiceCustomTemplate,
        receiptCustomTemplate: t.receiptCustomTemplate,
        useCustomInvoiceTemplate: t.useCustomInvoiceTemplate,
        midtransMerchantId: t.midtransMerchantId,
        midtransIsProduction: t.midtransIsProduction,
      };
    },
  );

  app.post(
    "/settings/preview-invoice",
    { preHandler: [requireRole("owner", "admin", "agent")] },
    async (request) => {
      const body = z
        .object({
          template: z.string().optional(),
          type: z.enum(["invoice", "receipt"]).default("invoice"),
          invoiceHeader: z.string().optional(),
          invoiceFooter: z.string().optional(),
          receiptHeader: z.string().optional(),
          receiptFooter: z.string().optional(),
          useCustomInvoiceTemplate: z.boolean().optional(),
        })
        .parse(request.body || {});

      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: request.tenant.tenantId },
      });

      const sampleOrder: any = {
        id: "cmspg8888sample999",
        status: body.type === "receipt" ? "paid" : "confirmed",
        total: 150000,
        note: "Mohon dikirim sore hari",
        createdAt: new Date(),
        contact: { name: "Budi Santoso" },
        items: [
          { qty: 2, price: 50000, product: { name: "Kopi Susu Senja 500ml" } },
          { qty: 1, price: 50000, product: { name: "Croissant Almond Butter" } },
        ],
        tenant: {
          ...tenant,
          ...(body.invoiceHeader != null ? { invoiceHeader: body.invoiceHeader } : {}),
          ...(body.invoiceFooter != null ? { invoiceFooter: body.invoiceFooter } : {}),
          ...(body.receiptHeader != null ? { receiptHeader: body.receiptHeader } : {}),
          ...(body.receiptFooter != null ? { receiptFooter: body.receiptFooter } : {}),
          ...(body.template != null
            ? body.type === "receipt"
              ? { receiptCustomTemplate: body.template }
              : { invoiceCustomTemplate: body.template }
            : {}),
          ...(body.useCustomInvoiceTemplate != null
            ? { useCustomInvoiceTemplate: body.useCustomInvoiceTemplate }
            : {}),
        },
      };

      const { formatInvoiceText, formatPaidReceiptText } = await import("../lib/invoice.js");
      const previewText = body.type === "receipt"
        ? formatPaidReceiptText(sampleOrder)
        : formatInvoiceText(sampleOrder);

      return { previewText };
    },
  );

  app.post(
    "/settings/test-midtrans",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const body = z
        .object({
          midtransServerKey: z.string().optional(),
          midtransIsProduction: z.boolean().optional(),
        })
        .parse(request.body || {});

      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenant.tenantId },
        select: { midtransServerKey: true, midtransIsProduction: true },
      });

      const serverKey = body.midtransServerKey?.trim() || tenant?.midtransServerKey?.trim() || "";
      const isProduction = body.midtransIsProduction ?? tenant?.midtransIsProduction ?? false;

      const { testMidtransCredentials } = await import("../lib/midtrans.js");
      const result = await testMidtransCredentials({ serverKey, isProduction });

      return result;
    },
  );

  // —— Products ——
  app.get("/products", async (request) => {
    const q = request.query as { all?: string; search?: string };
    const rows = await prisma.product.findMany({
      where: {
        tenantId: request.tenant.tenantId,
        ...(q.all === "1" ? {} : { active: true }),
        ...(q.search
          ? { name: { contains: q.search, mode: "insensitive" } }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 100,
    });
    return rows.map(mapProduct);
  });

  app.post(
    "/products",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const body = z
        .object({
          name: z.string().min(1).max(120),
          description: z.string().max(2000).optional(),
          price: z.number().int().min(0),
          stock: z.number().int().nullable().optional(),
          unit: z.string().max(20).optional(),
          active: z.boolean().optional(),
          imageUrl: z.string().url().nullable().optional(),
        })
        .parse(request.body);
      const p = await prisma.product.create({
        data: {
          tenantId: request.tenant.tenantId,
          name: body.name,
          description: body.description ?? "",
          price: body.price,
          stock: body.stock ?? null,
          unit: body.unit ?? "pcs",
          active: body.active ?? true,
          imageUrl: body.imageUrl ?? null,
        },
      });
      return reply.code(201).send(mapProduct(p));
    },
  );

function extractProductsFromText(text: string) {
  const lines = text.split("\n");
  const products: { name: string; price: number; stock: number | null; unit: string; description: string }[] = [];

  let currentCategory = "";

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith("[") || /^\d+\.\s+/.test(line)) {
      currentCategory = line.replace(/^\[|\]$/g, "").replace(/^\d+\.\s+/, "").replace(/\(.*?\)/g, "").trim();
    }

    const priceMatch = line.match(/^(?:[-*•\d.]+\s*)?([^:]+):\s*(?:mulai\s*)?(?:Rp\.?\s*([\d.]+)|(\d+)\s*k|gratis)/i);
    if (priceMatch) {
      let rawName = priceMatch[1].trim();
      const rpVal = priceMatch[2];
      const kVal = priceMatch[3];
      const isGratis = /gratis/i.test(line);

      let price = 0;
      if (isGratis) {
        price = 0;
      } else if (rpVal) {
        price = parseInt(rpVal.replace(/\./g, ""), 10) || 0;
      } else if (kVal) {
        price = parseInt(kVal, 10) * 1000 || 0;
      }

      let unit = "pcs";
      if (line.includes("/bulan") || line.includes("bulan")) unit = "bulan";
      else if (line.includes("/tahun") || line.includes("tahun")) unit = "tahun";
      else if (line.includes("unit")) unit = "unit";
      else if (line.includes("sesi")) unit = "sesi";

      let desc = "";
      const parenMatch = rawName.match(/\((.*?)\)/);
      if (parenMatch) {
        desc = parenMatch[1];
        rawName = rawName.replace(/\(.*?\)/, "").trim();
      }

      products.push({
        name: rawName,
        price,
        stock: null,
        unit,
        description: desc || (currentCategory ? `Kategori: ${currentCategory}` : ""),
      });
    }
  }

  return products;
}

  app.post(
    "/products/extract-from-knowledge",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const tenantId = request.tenant.tenantId;
      const body = z
        .object({
          documentId: z.string().optional(),
        })
        .parse(request.body || {});

      const chunks = await prisma.knowledgeChunk.findMany({
        where: {
          tenantId,
          ...(body.documentId ? { documentId: body.documentId } : {}),
        },
        take: 50,
      });

      const docs = await prisma.knowledgeDocument.findMany({
        where: {
          tenantId,
          ...(body.documentId ? { id: body.documentId } : {}),
        },
        take: 10,
      });

      if (!chunks.length && !docs.length) {
        return reply.code(400).send({
          error: "Belum ada dokumen Knowledge Base. Silakan unggah dokumen / FAQ terlebih dahulu di menu Knowledge.",
        });
      }

      const chunkTexts = chunks.map((c) => c.content);
      const docTitles = docs.map((d) => d.title);
      const combinedText = [...docTitles, ...chunkTexts].join("\n\n");

      // 1. Try smart regex pattern extractor first (guaranteed for pricelists)
      let formatted = extractProductsFromText(combinedText);

      // 2. If pattern extractor finds products, return them immediately
      if (formatted.length > 0) {
        return {
          ok: true,
          count: formatted.length,
          products: formatted,
        };
      }

      // 3. Fallback to OpenAI LLM extraction if pattern matching is empty
      const prompt = `Anda adalah sistem AI ekstraksi data katalog e-commerce & tarif jasa UMKM.
Tugas Anda adalah membaca dokumen teks berikut dan mengekstrak seluruh daftar produk, barang, makanan, atau tarif layanan jasa yang dapat dijual.

DOKUMEN KNOWLEDGE BASE:
${combinedText.slice(0, 8000)}

ATURAN EXTRACTION:
1. Kembalikan HANYA JSON array murni tanpa format markdown \`\`\`json. Format harus array of objects:
[
  {
    "name": "string (nama produk/layanan)",
    "price": number (angka harga rupiah murni tanpa huruf, contoh: 25000),
    "stock": number | null (angka stok jika ada, null jika tidak disebutkan/unlimited),
    "unit": "string (pcs / porsi / sesi / jam / paket)",
    "description": "string (deskripsi singkat jika ada)"
  }
]
2. Jika tidak ada harga spesifik yang terdeteksi pada suatu item, beri perkiraan harga 0.
3. Jangan mengarang produk yang tidak ada di teks.`;

      try {
        const res = await chatComplete([
          { role: "user", content: prompt },
        ]);

        let jsonStr = (res.content || "").trim();
        jsonStr = jsonStr.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

        const extracted = JSON.parse(jsonStr);
        if (Array.isArray(extracted) && extracted.length > 0) {
          formatted = extracted.map((item: any) => ({
            name: String(item.name || "Produk").slice(0, 100),
            price: Math.max(0, Math.floor(Number(item.price) || 0)),
            stock: item.stock != null ? Math.max(0, Math.floor(Number(item.stock) || 0)) : null,
            unit: String(item.unit || "pcs").slice(0, 20),
            description: String(item.description || "").slice(0, 500),
          }));
        }
      } catch (err) {
        request.log.warn({ err }, "AI extraction fallback triggered pattern parser");
      }

      return {
        ok: true,
        count: formatted.length,
        products: formatted,
      };
    },
  );

  app.post(
    "/products/batch-import",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const tenantId = request.tenant.tenantId;
      const body = z
        .object({
          products: z.array(
            z.object({
              name: z.string().min(1).max(120),
              price: z.number().int().min(0),
              stock: z.number().int().nullable().optional(),
              unit: z.string().max(20).optional(),
              description: z.string().max(2000).optional(),
            }),
          ),
        })
        .parse(request.body);

      if (!body.products.length) {
        return reply.code(400).send({ error: "Daftar produk kosong" });
      }

      const created = await prisma.$transaction(
        body.products.map((p) =>
          prisma.product.create({
            data: {
              tenantId,
              name: p.name,
              price: p.price,
              stock: p.stock ?? null,
              unit: p.unit || "pcs",
              description: p.description || "",
              active: true,
            },
          }),
        ),
      );

      return {
        ok: true,
        count: created.length,
        products: created.map(mapProduct),
      };
    },
  );

  app.patch(
    "/products/:id",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          name: z.string().min(1).max(120).optional(),
          description: z.string().max(2000).optional(),
          price: z.number().int().min(0).optional(),
          stock: z.number().int().nullable().optional(),
          unit: z.string().max(20).optional(),
          active: z.boolean().optional(),
          imageUrl: z.string().url().nullable().optional(),
        })
        .parse(request.body);
      const existing = await prisma.product.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "Not found" });
      const p = await prisma.product.update({
        where: { id },
        data: body,
      });
      return mapProduct(p);
    },
  );

  app.delete(
    "/products/:id",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.product.findFirst({
        where: { id, tenantId: request.tenant.tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "Not found" });
      // soft-delete
      await prisma.product.update({
        where: { id },
        data: { active: false },
      });
      return reply.code(204).send();
    },
  );

  // —— Orders ——
  app.post("/orders", async (request, reply) => {
    const body = z
      .object({
        contactName: z.string().min(1).max(100),
        contactPhone: z.string().min(1).max(30),
        note: z.string().max(1000).optional(),
        status: z
          .enum(["draft", "confirmed", "paid", "done", "cancelled"])
          .default("confirmed"),
        items: z
          .array(
            z.object({
              productId: z.string().optional(),
              name: z.string().min(1),
              qty: z.number().int().min(1),
              price: z.number().min(0),
            }),
          )
          .min(1),
      })
      .parse(request.body);

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

    // Find or create default product if productId not passed
    let defaultProduct = await prisma.product.findFirst({
      where: { tenantId: request.tenant.tenantId, active: true },
    });

    if (!defaultProduct) {
      defaultProduct = await prisma.product.create({
        data: {
          tenantId: request.tenant.tenantId,
          name: "Produk General",
          description: "Produk pesanan manual",
          price: 0,
          unit: "pcs",
        },
      });
    }

    const total = body.items.reduce((acc, it) => acc + it.qty * it.price, 0);

    const order = await prisma.order.create({
      data: {
        tenantId: request.tenant.tenantId,
        contactId: contact.id,
        status: body.status,
        total,
        note: body.note?.trim() || "",
        items: {
          create: body.items.map((it) => ({
            productId: it.productId || defaultProduct!.id,
            qty: it.qty,
            price: Math.round(it.price),
          })),
        },
      },
      include: {
        contact: true,
        items: { include: { product: true } },
      },
    });

    return reply.code(201).send(mapOrder(order));
  });

  app.get("/orders", async (request) => {
    const q = request.query as { status?: string; limit?: string };
    const status = q.status as OrderStatus | undefined;
    const rows = await prisma.order.findMany({
      where: {
        tenantId: request.tenant.tenantId,
        ...(status ? { status } : {}),
      },
      include: {
        contact: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(q.limit) || 50, 100),
    });
    return rows.map(mapOrder);
  });

  app.get("/orders/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await prisma.order.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
      include: {
        contact: true,
        items: { include: { product: true } },
      },
    });
    if (!row) return reply.code(404).send({ error: "Not found" });
    return mapOrder(row);
  });

  app.patch("/orders/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        status: z
          .enum(["draft", "confirmed", "paid", "done", "cancelled"])
          .optional(),
        note: z.string().max(1000).optional(),
      })
      .parse(request.body);

    const existing = await prisma.order.findFirst({
      where: { id, tenantId: request.tenant.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    // stock adjust when confirming
    if (body.status === "confirmed" && existing.status === "draft") {
      const items = await prisma.orderItem.findMany({
        where: { orderId: id },
        include: { product: true },
      });
      for (const it of items) {
        if (it.product.stock != null) {
          if (it.product.stock < it.qty) {
            return reply.code(400).send({
              error: `Stok ${it.product.name} tidak cukup`,
            });
          }
          await prisma.product.update({
            where: { id: it.productId },
            data: { stock: it.product.stock - it.qty },
          });
        }
      }
    }

    const becamePaid =
      body.status === "paid" && existing.status !== "paid";

    const row = await prisma.order.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.note != null ? { note: body.note } : {}),
      },
      include: {
        contact: true,
        items: { include: { product: true } },
      },
    });

    // B3 — auto send paid receipt when marked lunas
    let receipt: { ok: boolean; error?: string } | undefined;
    if (becamePaid) {
      void analyzeConversationForContact(request.tenant.tenantId, row.contactId);

      void createAndEmitNotification({
        tenantId: request.tenant.tenantId,
        type: "payment_received",
        title: "💰 Pembayaran Lunas",
        message: `Order #${row.id.slice(-6).toUpperCase()} (${row.contact.name}) senilai Rp ${row.total.toLocaleString("id-ID")} telah dikonfirmasi LUNAS!`,
        link: "/orders",
        metadata: {
          orderId: row.id,
          total: row.total,
          contactName: row.contact.name,
        },
      });

      const sent = await sendOrderInvoiceWa({
        tenantId: request.tenant.tenantId,
        orderId: id,
        kind: "paid",
        agent: {
          id: request.authUser.id,
          name: request.authUser.name,
        },
      });
      if (sent.ok) {
        request.log.info({ orderId: id }, "B3 paid receipt auto-sent");
        receipt = { ok: true };
      } else {
        request.log.warn(
          { orderId: id, error: sent.error },
          "B3 paid receipt failed (order still paid)",
        );
        receipt = { ok: false, error: sent.error };
      }
    }

    return { ...mapOrder(row), ...(receipt ? { receipt } : {}) };
  });

  // —— B2: send invoice / paid receipt via WhatsApp ——
  app.post(
    "/orders/:id/invoice",
    { preHandler: [requireRole("owner", "admin", "agent")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          kind: z.enum(["invoice", "paid"]).optional().default("invoice"),
        })
        .parse(request.body ?? {});

      const result = await sendOrderInvoiceWa({
        tenantId: request.tenant.tenantId,
        orderId: id,
        kind: body.kind,
        agent: {
          id: request.authUser.id,
          name: request.authUser.name,
        },
      });
      if (!result.ok) {
        return reply.code(result.status).send({ error: result.error });
      }
      request.log.info(
        { orderId: id, kind: result.kind, conversationId: result.conversationId },
        "invoice sent",
      );
      return result;
    },
  );

  app.get("/orders/export-csv", async (request, reply) => {
    const orders = await prisma.order.findMany({
      where: { tenantId: request.tenant.tenantId },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
    });

    const header = "ID Order,Nama Pelanggan,Nomor WA,Total (Rp),Status,Tanggal Dibuat\n";
    const rows = orders.map((o) => {
      const cleanName = `"${o.contact.name.replace(/"/g, '""')}"`;
      return `${o.id.slice(-6).toUpperCase()},${cleanName},${o.contact.phone},${o.total},${o.status},${o.createdAt.toISOString()}`;
    });

    const csvContent = header + rows.join("\n");
    reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", 'attachment; filename="laporan-pesanan.csv"')
      .send(csvContent);
  });
}
