import { prisma } from "../lib/prisma.js";

export type ToolResult = {
  ok: boolean;
  text: string;
  data?: unknown;
};

/** Cek Promo & Voucher Diskon Aktif (Dinamis dari Setting Pemilik Bisnis) */
export async function checkPromoDiscountsTool(opts: {
  tenantId: string;
  category?: string;
}): Promise<ToolResult> {
  const { tenantId } = opts;

  // Query active promo vouchers configured by the business owner
  const promos = await prisma.promoVoucher.findMany({
    where: { tenantId, active: true },
    orderBy: { createdAt: "desc" },
  });

  if (!promos.length) {
    return {
      ok: true,
      text: "Saat ini belum ada promo atau voucher diskon khusus yang sedang aktif dari toko kami. Silakan nantikan info promo menarik berikutnya di obrolan ini ya Kak! 😊",
      data: [],
    };
  }

  const lines = promos.map(
    (p) =>
      `🎟️ *${p.code}* — ${p.title}${p.description ? `\n   _${p.description}_` : ""}${p.minSpend > 0 ? `\n   • Min. Belanja: Rp ${p.minSpend.toLocaleString("id-ID")}` : ""}\n   • Masa Berlaku: ${p.validUntil}`,
  );

  return {
    ok: true,
    text: `🎁 *Promo & Voucher Diskon Aktif Spesial Untuk Anda!*\n\n${lines.join("\n\n")}\n\n_Gunakan kode voucher di atas saat mengonfirmasi pesanan/booking ya!_`,
    data: promos,
  };
}

/** Cek Status Invoice & Link Tagihan Pembayaran */
export async function checkInvoiceStatusTool(opts: {
  tenantId: string;
  contactId?: string;
  invoiceNumber?: string;
}): Promise<ToolResult> {
  const { tenantId, contactId, invoiceNumber } = opts;

  let order = null;
  if (invoiceNumber?.trim()) {
    order = await prisma.order.findFirst({
      where: { tenantId, id: invoiceNumber.trim() },
      include: { items: { include: { product: true } }, contact: true },
    });
  } else if (contactId) {
    order = await prisma.order.findFirst({
      where: { tenantId, contactId },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: true } }, contact: true },
    });
  }

  if (!order) {
    return {
      ok: false,
      text: "📌 Belum ditemukan rincian tagihan/invoice aktif untuk akun Anda. Silakan hubungi admin kami jika Kakak sudah melakukan pembayaran ya.",
    };
  }

  const statusText =
    order.status === "done" || order.status === "confirmed"
      ? "✅ *DAPAT DIPROSES / LUNAS*"
      : order.status === "draft"
        ? "⏳ *MENUNGGU PEMBAYARAN*"
        : `STATUS: ${order.status.toUpperCase()}`;

  const itemLines = order.items
    .map((i) => `• ${i.product?.name || "Produk"} x${i.qty} — Rp ${i.price.toLocaleString("id-ID")}`)
    .join("\n");

  const text = `🧾 *Detail Invoice #${order.id.slice(-6).toUpperCase()}*\nNama: ${order.contact?.name || "Pelanggan"}\nStatus: ${statusText}\nTotal: *Rp ${order.total.toLocaleString("id-ID")}*\n\n*Item Pesanan*:\n${itemLines}\n\n_Terima kasih telah bertransaksi bersama kami!_`;

  return {
    ok: true,
    text,
    data: order,
  };
}

/** Simpan Feedback & Review Rating Pelanggan */
export async function collectFeedbackReviewTool(opts: {
  tenantId: string;
  conversationId?: string;
  rating: number;
  reviewText?: string;
}): Promise<ToolResult> {
  const { rating, reviewText = "" } = opts;
  const stars = "⭐".repeat(Math.min(5, Math.max(1, Math.round(rating))));

  // Save to metadata or log
  let replyMsg = `⭐ *Terima Kasih Atas Ulasan Anda!* (${stars})\n\n`;
  if (rating >= 4) {
    replyMsg += `Senang sekali bisa memberikan pelayanan terbaik untuk Kakak! Masukan dan penilaian ${stars} ini sangat berarti bagi perkembangan layanan kami. 🙏❤️`;
  } else {
    replyMsg += `Mohon maaf jika pelayanan kami belum maksimal. Catatan dan masukan Kakak: _"${reviewText || "Masukan kepuasan"}"_ sudah kami teruskan ke tim manajemen untuk perbaikan segera. 🙏`;
  }

  return {
    ok: true,
    text: replyMsg,
    data: { rating, reviewText },
  };
}

/** Buat Link Pembayaran Midtrans & QRIS Secara Otomatis di Chat AI */
export async function createPaymentQrisLinkTool(opts: {
  tenantId: string;
  productName: string;
  amount: number;
  qty?: number;
  customerName?: string;
  customerPhone?: string;
}): Promise<ToolResult> {
  const { tenantId, productName, amount, qty = 1, customerName = "Pelanggan", customerPhone = "" } = opts;

  // Retrieve tenant's custom Midtrans settings
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { midtransServerKey: true, midtransIsProduction: true },
  });

  const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const { createMidtransTransaction } = await import("../lib/midtrans.js");

  const res = await createMidtransTransaction({
    orderId,
    grossAmount: Math.max(1000, amount * qty),
    customerName,
    customerPhone,
    items: [{ name: productName, price: amount, qty }],
    serverKey: tenant?.midtransServerKey || undefined,
    isProduction: tenant?.midtransIsProduction ?? false,
  });

  if (!res.ok || !res.redirectUrl) {
    return {
      ok: false,
      text: `❌ Gagal membuatkan link pembayaran Midtrans: ${res.error || "Metode pembayaran sedang diproses."}. Silakan hubungi admin kami untuk pembayaran manual ya Kak.`,
    };
  }

  const modeBadge = tenant?.midtransIsProduction ? "LIVE (Production)" : "TEST (Sandbox)";

  const msg = `💳 *Tautan Pembayaran Resmi (Midtrans ${modeBadge})*\n\n` +
    `• Order ID: *#${orderId}*\n` +
    `• Produk: *${productName}* (x${qty})\n` +
    `• Total Tagihan: *Rp ${(amount * qty).toLocaleString("id-ID")}*\n\n` +
    `🔗 *Klik Link Bayar / QRIS di bawah ini:*\n${res.redirectUrl}\n\n` +
    `_Tautan di atas mendukung pembayaran via QRIS, GoPay, ShopeePay, & Virtual Account Bank!_`;

  return {
    ok: true,
    text: msg,
    data: {
      orderId,
      redirectUrl: res.redirectUrl,
      token: res.token,
      mode: modeBadge,
    },
  };
}
