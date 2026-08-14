import { prisma } from "../lib/prisma.js";
import {
  formatInvoiceText,
  formatPaymentInstructionsOnly,
  formatRp,
  orderRef,
} from "../lib/invoice.js";

export type ToolResult = {
  ok: boolean;
  text: string;
  data?: unknown;
};

export async function listProducts(
  tenantId: string,
  query?: string,
): Promise<ToolResult> {
  const q = query?.trim();
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 15,
  });
  if (!products.length) {
    return {
      ok: true,
      text: q
        ? `Tidak ada produk cocok untuk "${q}".`
        : "Belum ada produk di katalog. Minta admin isi menu Katalog.",
    };
  }
  const lines = products.map(
    (p) =>
      `• ${p.name} — ${formatRp(p.price)}/${p.unit}` +
      (p.stock != null ? ` (stok ${p.stock})` : "") +
      (p.imageUrl ? ` [Foto: ${p.imageUrl}]` : ""),
  );
  return {
    ok: true,
    text: `Katalog:\n${lines.join("\n")}`,
    data: products,
  };
}

export async function getProduct(
  tenantId: string,
  nameOrId: string,
): Promise<ToolResult> {
  const key = nameOrId.trim();
  const product =
    (await prisma.product.findFirst({
      where: { tenantId, id: key, active: true },
    })) ||
    (await prisma.product.findFirst({
      where: {
        tenantId,
        active: true,
        name: { contains: key, mode: "insensitive" },
      },
    }));
  if (!product) {
    return { ok: false, text: `Produk "${key}" tidak ditemukan.` };
  }
  const stock =
    product.stock == null ? "tidak ditampilkan" : String(product.stock);
  const imgStr = product.imageUrl ? `\nFoto Produk: ${product.imageUrl}` : "";
  return {
    ok: true,
    text: `${product.name}\nHarga: ${formatRp(product.price)}/${product.unit}\nStok: ${stock}\n${product.description || ""}${imgStr}`.trim(),
    data: product,
  };
}

export async function createOrderDraft(
  tenantId: string,
  contactId: string,
  items: { productName: string; qty: number }[],
  note = "",
): Promise<ToolResult> {
  if (!items.length) {
    return { ok: false, text: "Item pesanan kosong." };
  }

  const resolved: {
    productId: string;
    name: string;
    qty: number;
    price: number;
  }[] = [];

  for (const it of items) {
    const qty = Math.max(1, Math.floor(it.qty || 1));
    const product = await prisma.product.findFirst({
      where: {
        tenantId,
        active: true,
        name: { contains: it.productName.trim(), mode: "insensitive" },
      },
    });
    if (!product) {
      return {
        ok: false,
        text: `Produk "${it.productName}" tidak ada di katalog.`,
      };
    }
    if (product.stock != null && product.stock < qty) {
      return {
        ok: false,
        text: `Stok ${product.name} tidak cukup (tersedia ${product.stock}).`,
      };
    }
    resolved.push({
      productId: product.id,
      name: product.name,
      qty,
      price: product.price,
    });
  }

  const total = resolved.reduce((s, r) => s + r.price * r.qty, 0);
  const order = await prisma.order.create({
    data: {
      tenantId,
      contactId,
      status: "draft",
      total,
      note,
      items: {
        create: resolved.map((r) => ({
          productId: r.productId,
          qty: r.qty,
          price: r.price,
        })),
      },
    },
    include: {
      items: { include: { product: true } },
      contact: true,
      tenant: true,
    },
  });

  const invoice = formatInvoiceText(order);

  // Generate Midtrans Sandbox Payment Link / Dynamic QRIS
  let payLinkNote = "";
  try {
    const { createMidtransTransaction } = await import("../lib/midtrans.js");
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const midtransRes = await createMidtransTransaction({
      orderId: order.id,
      grossAmount: order.total,
      customerName: order.contact.name || "Pelanggan WA",
      customerPhone: order.contact.phone || "",
      items: resolved.map((r) => ({ name: r.name, price: r.price, qty: r.qty })),
      serverKey: tenant?.midtransServerKey,
      isProduction: tenant?.midtransIsProduction,
    });

    if (midtransRes.ok && midtransRes.redirectUrl) {
      payLinkNote = `\n\n💳 *Tautan Bayar Instan (QRIS/VA Midtrans)*:\n${midtransRes.redirectUrl}\n_Scan QRIS / pilih cara bayar di atas untuk konfirmasi lunas otomatis 24 jam._`;
    }
  } catch (err) {
    console.warn("failed creating Midtrans charge for order draft", err);
  }

  return {
    ok: true,
    text: `${invoice}${payLinkNote}\n\n_Pesanan draft #${orderRef(order.id)} — siap dibayar. Ketik *cs* bila butuh bantuan._`,
    data: { orderId: order.id, total, status: order.status },
  };
}

export async function getPaymentInfo(
  tenantId: string,
  contactId?: string,
): Promise<ToolResult> {
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const manualInfo = formatPaymentInstructionsOnly(t);

  let qrisNote = "";
  if (contactId) {
    const pendingOrder = (await prisma.order.findFirst({
      where: { tenantId, contactId, status: { in: ["draft", "confirmed"] } },
      orderBy: { createdAt: "desc" },
      include: { contact: true, items: { include: { product: true } } },
    })) as any;

    if (pendingOrder) {
      try {
        const { createMidtransTransaction } = await import("../lib/midtrans.js");
        const midtransRes = await createMidtransTransaction({
          orderId: pendingOrder.id,
          grossAmount: pendingOrder.total,
          customerName: pendingOrder.contact?.name || "Pelanggan WA",
          customerPhone: pendingOrder.contact?.phone || "",
          items: pendingOrder.items.map((i: any) => ({
            name: i.product.name,
            price: i.price,
            qty: i.qty,
          })),
          serverKey: t.midtransServerKey,
          isProduction: t.midtransIsProduction,
        });

        if (midtransRes.ok && midtransRes.redirectUrl) {
          qrisNote = `\n\n💳 *Tautan Bayar Instan QRIS / Midtrans (Pesanan #${orderRef(pendingOrder.id)})*:\n${midtransRes.redirectUrl}\n_Pilih QRIS / E-Wallet (GoPay/ShopeePay/VA) di atas untuk pelunasan otomatis 24 jam._`;
        }
      } catch (err) {
        console.warn("Midtrans link creation error in getPaymentInfo", err);
      }
    }
  }

  if (!qrisNote) {
    qrisNote = `\n\n💳 *Payment Gateway (QRIS / E-Wallet / VA)*:\nTautan bayar QRIS instan Midtrans otomatis disertakan pada setiap pesanan/nota yang Anda buat. Silakan sebutkan produk / layanan yang ingin dipesan untuk mendapatkan link QRIS pembayaran instan.`;
  }

  return {
    ok: true,
    text: `${manualInfo}${qrisNote}`,
    data: {
      payBank: t.payBank,
      payAccount: t.payAccount,
      payAccountName: t.payAccountName,
      payNote: t.payNote,
    },
  };
}

export async function getOrderStatus(
  tenantId: string,
  contactId: string,
  orderIdHint?: string,
): Promise<ToolResult> {
  // Check latest booking first
  const latestBooking = await prisma.booking.findFirst({
    where: { tenantId, contactId },
    orderBy: { createdAt: "desc" },
    include: { contact: true },
  });

  // Check latest order
  const order = orderIdHint
    ? await prisma.order.findFirst({
        where: {
          tenantId,
          contactId,
          OR: [
            { id: orderIdHint },
            { id: { endsWith: orderIdHint.replace(/^#/, "") } },
          ],
        },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
      })
    : await prisma.order.findFirst({
        where: { tenantId, contactId },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
      });

  if (latestBooking && (!order || latestBooking.createdAt > order.createdAt)) {
    const formattedDate = new Date(latestBooking.bookingDate).toLocaleString("id-ID", {
      dateStyle: "full",
      timeStyle: "short",
    });
    return {
      ok: true,
      text: `📅 *Detail Reservasi / Booking Anda*:\n\n• Layanan: *${latestBooking.serviceName}*\n• Jadwal: ${formattedDate}\n• Nama: ${latestBooking.contact.name}\n• Status: *${latestBooking.status.toUpperCase()}*${latestBooking.note ? `\n• Catatan: ${latestBooking.note}` : ""}\n\n_Ketik *cs* jika ingin mengubah jadwal atau membutuhkan bantuan admin._`,
      data: latestBooking,
    };
  }

  if (!order) {
    return { ok: true, text: "Maaf kak, saat ini belum ditemukan data pesanan atau booking aktif atas nama Anda di sistem." };
  }
  const lines = order.items.map(
    (i) => `• ${i.product.name} x${i.qty}`,
  );
  return {
    ok: true,
    text: `📦 *Detail Pesanan #${orderRef(order.id)}*:\nStatus: *${order.status.toUpperCase()}*\n${lines.join("\n")}\nTotal: ${formatRp(order.total)}`,
    data: order,
  };
}

/** Intent-based tool router for commerce (no LLM function-calling required). */
export async function tryCommerceTools(opts: {
  tenantId: string;
  contactId: string;
  text: string;
}): Promise<ToolResult | null> {
  const t = opts.text.toLowerCase().trim();

  // list catalog
  if (
    /^(katalog|menu|daftar produk|list produk|apa saja|produk apa)/i.test(t) ||
    /\b(katalog|daftar menu|list menu)\b/i.test(t)
  ) {
    return listProducts(opts.tenantId);
  }

  // booking / order status query: "detail booking saya apa", "cek booking", "status booking", "orderan saya"
  if (
    /\b(detail|cek|status|info|lihat)\b.*\b(booking|reservasi|jadwal|pesanan|order)\b/i.test(t) ||
    /\b(booking saya|pesanan saya|orderan saya|jadwal saya)\b/i.test(t)
  ) {
    return getOrderStatus(opts.tenantId, opts.contactId);
  }

  // price / product query: "harga X", "berapa X", "stok X", "Saya mau service AC berapa biaya nya"
  if (/\b(harga|berapa|biaya|biayanya|stok|ada|tarif|ongkir|pricelist)\b/i.test(t)) {
    // Strip common question filler words to isolate actual product/service name
    const cleaned = t
      .replace(/\b(saya|mau|tolong|mohon|info|infonya|berapa|biaya|biayanya|harga|harganya|tarif|ongkir|stok|ada|kah|nya|sih|dong|ya|kak|bang|min|admin|service|servis)\b/gi, "")
      .replace(/[^\w\s]/g, "")
      .trim();

    if (cleaned.length > 1) {
      const prodRes = await getProduct(opts.tenantId, cleaned);
      if (prodRes.ok) return prodRes;
    }

    // Also try searching using full text minus question terms
    const rawTarget = t
      .replace(/\b(berapa|biaya|biayanya|harga|harganya|tarif|ongkir|stok|ada|kah|nya|sih|dong|ya)\b/gi, "")
      .replace(/[^\w\s]/g, "")
      .trim();

    if (rawTarget.length > 1) {
      const prodRes = await getProduct(opts.tenantId, rawTarget);
      if (prodRes.ok) return prodRes;
    }

    // If generic question like "Harga nya berapa" without specific product, list products
    if (!cleaned && !rawTarget) {
      return listProducts(opts.tenantId);
    }
  }

  // order: "pesan 2 kopi", "mau order es teh 1"
  const orderMatch = t.match(
    /(?:pesan|order|mau\s+pesan|minta)\s+(?:(\d+)\s+)?(.+)/i,
  );
  if (orderMatch) {
    const qty = orderMatch[1] ? Number(orderMatch[1]) : 1;
    let name = (orderMatch[2] || "")
      .replace(/\b(dong|ya|kak|bang|tolong)\b/gi, "")
      .trim();
    // "2x kopi" form already captured; also "kopi 2"
    const tailQty = name.match(/^(.+?)\s+(\d+)$/);
    let finalQty = qty;
    if (tailQty) {
      name = tailQty[1].trim();
      finalQty = Number(tailQty[2]) || qty;
    }
    if (name.length > 1) {
      const orderRes = await createOrderDraft(
        opts.tenantId,
        opts.contactId,
        [{ productName: name, qty: finalQty }],
      );
      if (orderRes.ok) return orderRes;
    }
  }

  // multi item simple: "pesan kopi dan teh" → two qty 1
  if (/\b(pesan|order)\b/i.test(t) && /\b(dan|&)\b/i.test(t)) {
    const after = t.replace(/^.*?(?:pesan|order)\s+/i, "");
    const parts = after
      .split(/\s+dan\s+|\s*&\s*/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 1);
    if (parts.length >= 2) {
      const orderRes = await createOrderDraft(
        opts.tenantId,
        opts.contactId,
        parts.map((productName) => ({ productName, qty: 1 })),
      );
      if (orderRes.ok) return orderRes;
    }
  }

  // status
  if (
    /status\s*(pesanan|order)?/i.test(t) ||
    /pesanan\s*saya/i.test(t) ||
    /cek\s*order/i.test(t)
  ) {
    return getOrderStatus(opts.tenantId, opts.contactId);
  }

  // B1 — cara bayar
  if (
    /\b(cara bayar|rekening|transfer|qris|bayar ke|no rek|nomor rekening)\b/i.test(
      t,
    ) ||
    /^(bayar|pembayaran)$/i.test(t)
  ) {
    return getPaymentInfo(opts.tenantId, opts.contactId);
  }

  return null;
}

export async function cancelBookingOrOrderTool(
  tenantId: string,
  contactId: string,
  targetType?: "booking" | "order" | "auto",
  reason?: string,
): Promise<ToolResult> {
  const settings = await prisma.botSettings.findUnique({
    where: { tenantId },
  });
  const deadlineHours = settings?.cancelDeadlineHours ?? 2;

  // 1. Try finding active booking
  if (!targetType || targetType === "booking" || targetType === "auto") {
    const booking = await prisma.booking.findFirst({
      where: {
        tenantId,
        contactId,
        status: { in: ["pending", "confirmed"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (booking) {
      // Check cancellation deadline
      const now = new Date();
      const bookingTime = new Date(booking.bookingDate);
      const diffHours = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (diffHours < deadlineHours && diffHours > 0) {
        return {
          ok: false,
          text: `Mohon maaf, pembatalan mandiri via bot hanya dapat dilakukan maksimal ${deadlineHours} jam sebelum jadwal reservasi (${booking.serviceName} pada ${booking.bookingDate.toLocaleDateString("id-ID")}). Silakan ketik *cs* untuk dihubungkan dengan staf Customer Service kami untuk bantuan lebih lanjut.`,
        };
      }

      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "cancelled",
          note: `Dibatalkan via AI. Alasan: ${reason || "Permintaan pelanggan"}`,
        },
      });

      return {
        ok: true,
        text: `✅ *Reservasi Berhasil Dibatalkan*\n\nJadwal reservasi *${booking.serviceName}* pada tanggal *${booking.bookingDate.toLocaleDateString("id-ID")}* telah resmi dibatalkan dan slot waktu telah dilepaskan.\n\nJika ingin membuat jadwal baru di lain waktu, silakan hubungi kami kembali ya! 🙏`,
        data: { bookingId: booking.id },
      };
    }
  }

  // 2. Try finding draft order
  if (!targetType || targetType === "order" || targetType === "auto") {
    const order = await prisma.order.findFirst({
      where: {
        tenantId,
        contactId,
        status: "draft",
      },
      orderBy: { createdAt: "desc" },
    });

    if (order) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "cancelled",
          note: `Dibatalkan via AI. Alasan: ${reason || "Permintaan pelanggan"}`,
        },
      });

      return {
        ok: true,
        text: `✅ *Pesanan Berhasil Dibatalkan*\n\nPesanan draft/invoice senilai *${formatRp(order.total)}* telah dibatalkan.\n\nJika ingin memesan menu lain, silakan tanyakan katalog kami kembali ya! 🙏`,
        data: { orderId: order.id },
      };
    }
  }

  return {
    ok: false,
    text: "Tidak ditemukan reservasi atau pesanan aktif yang dapat dibatalkan untuk akun Anda saat ini.",
  };
}

export async function getProductRecommendationTool(
  tenantId: string,
  maxPrice?: number,
  category?: string,
  occasion?: string,
): Promise<ToolResult> {
  const q = category?.trim() || occasion?.trim() || "";
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      active: true,
      ...(maxPrice ? { price: { lte: maxPrice } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { price: "desc" },
    take: 6,
  });

  if (!products.length) {
    return {
      ok: false,
      text: maxPrice
        ? `Mohon maaf, belum ada produk di katalog kami dengan budget di bawah ${formatRp(maxPrice)}.`
        : "Belum ada produk yang sesuai dengan kriteria rekomendasi tersebut.",
    };
  }

  const optionLines: string[] = [];
  products.slice(0, 3).forEach((p, idx) => {
    const icon = idx === 0 ? "🎁" : idx === 1 ? "🥖" : "🥐";
    const imgText = p.imageUrl ? `\n  • Foto: ${p.imageUrl}` : "";
    optionLines.push(
      `${icon} *Opsi ${String.fromCharCode(65 + idx)} — ${p.name} (${formatRp(p.price)})*\n  • ${p.description || "Produk Pilihan Terbaik"}${imgText}`,
    );
  });

  return {
    ok: true,
    text: `✨ *Rekomendasi Pilihan Terbaik (Budget ${maxPrice ? `s/d ${formatRp(maxPrice)}` : "Sesuai Kebutuhan"})*:\n\n${optionLines.join("\n\n")}\n\nManakah paket/produk yang paling cocok untuk Kakak? Saya bisa langsung bantu buatkan pesanannya sekarang! 😊`,
    data: products,
  };
}

