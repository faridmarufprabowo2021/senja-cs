import { prisma } from "./prisma.js";
import { waManager } from "../wa/manager.js";
import { chatComplete } from "./llm.js";
import { createMidtransTransaction } from "./midtrans.js";

export type ExecuteActionResult = {
  ok: boolean;
  executedCount: number;
  details: string;
  errors?: string[];
};

/**
 * Generates a hyper-personalized follow-up WhatsApp message based on past conversation history
 */
export async function generatePersonalizedFollowupText(
  tenantId: string,
  contactId: string,
): Promise<string> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { name: true, phone: true },
  });

  if (!contact) return "Halo Kak, ada yang bisa kami bantu kembali?";

  // Fetch last 10 messages for this contact
  const conv = await prisma.conversation.findFirst({
    where: { tenantId, contactId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  let recentMessagesText = "";
  if (conv) {
    const messages = await prisma.message.findMany({
      where: { tenantId, conversationId: conv.id },
      take: 10,
      orderBy: { createdAt: "asc" },
      select: { senderType: true, body: true },
    });
    recentMessagesText = messages
      .map((m) => `${m.senderType === "customer" ? "Customer" : "Toko"}: ${m.body}`)
      .join("\n");
  }

  // Fetch active promos
  const promos = await prisma.promoVoucher.findMany({
    where: { tenantId, active: true },
    take: 2,
    orderBy: { createdAt: "desc" },
  });

  const promoInfo = promos.length
    ? promos.map((p) => `Voucher "${p.code}": ${p.title}`).join(", ")
    : "Tidak ada voucher khusus";

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });

  const prompt = `Anda adalah Customer Service ramah dari toko "${tenant?.name || "Toko"}".
Tugas Anda adalah membuat 1 PESAN WHATSAPP FOLLOW-UP SINGKAT (maksimal 3-4 kalimat) yang sangat ramah dan personal untuk pelanggan bernama "${contact.name}".

RIWAYAT CHAT SEBELUMNYA:
${recentMessagesText || "(Belum ada riwayat chat)"}

PROMO AKTIF TOKO: ${promoInfo}

ATURAN WAJIB:
1. Sebutkan secara spesifik produk/layanan yang pernah ditanyakan atau dibahas customer pada riwayat chat sebelumnya.
2. Jawab atau tawarkan solusi atas keraguan mereka secara halus & sopan.
3. Jika ada promo aktif, selipkan kode voucher secara natural.
4. Akhiri dengan pertanyaan ramah (misal: "Apakah mau kami bantu jadwalkan / buatkan pesanan Kak?").
5. HANYA KELUARKAN TEKS PESAN WHATSAPP MURNI tanpa penjelasan tambahan.`;

  try {
    const res = await chatComplete([
      { role: "user", content: prompt },
    ]);
    return res.content?.trim() || `Halo Kak ${contact.name}, apakah ada yang bisa kami bantu mengenai pesanan/layanan Anda kemarin?`;
  } catch (err) {
    console.error("[executor] Error generating personalized follow-up text", err);
    return `Halo Kak ${contact.name}, apakah ada yang bisa kami bantu kembali hari ini? 😊`;
  }
}

/**
 * Execute Action: Hyper-Personalized Contextual Follow-Up
 */
export async function executeContextualFollowupAction(
  tenantId: string,
  contactIds: string[],
): Promise<ExecuteActionResult> {
  const waSession = await prisma.waSession.findFirst({
    where: { tenantId, status: "connected" },
  });

  if (!waSession) {
    return {
      ok: false,
      executedCount: 0,
      details: "Sesi WhatsApp belum terhubung. Silakan hubungkan WhatsApp di Pengaturan Saluran.",
    };
  }

  let count = 0;
  const errors: string[] = [];

  for (const cid of contactIds) {
    try {
      const contact = await prisma.contact.findUnique({
        where: { id: cid },
      });
      if (!contact || !contact.waJid) continue;

      const bodyText = await generatePersonalizedFollowupText(tenantId, cid);

      await waManager.sendText(waSession.id, contact.waJid, bodyText);

      // Save Message to DB
      const conv = await prisma.conversation.findFirst({
        where: { tenantId, contactId: cid },
        orderBy: { updatedAt: "desc" },
      });

      if (conv) {
        await prisma.message.create({
          data: {
            tenantId,
            conversationId: conv.id,
            direction: "out",
            senderType: "system",
            body: bodyText,
            metadata: { action: "copilot_contextual_followup" },
          },
        });
        await prisma.conversation.update({
          where: { id: conv.id },
          data: {
            lastMessagePreview: bodyText.slice(0, 100),
            lastMessageAt: new Date(),
          },
        });
      }

      count++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    ok: true,
    executedCount: count,
    details: `${count} pesan WhatsApp follow-up personal berbasis konteks percakapan berhasil terkirim.`,
    errors: errors.length ? errors : undefined,
  };
}

/**
 * Execute Action: Booking Reminders
 */
export async function executeBookingReminderAction(
  tenantId: string,
  contactIds: string[],
): Promise<ExecuteActionResult> {
  const waSession = await prisma.waSession.findFirst({
    where: { tenantId, status: "connected" },
  });

  if (!waSession) {
    return {
      ok: false,
      executedCount: 0,
      details: "Sesi WhatsApp belum terhubung.",
    };
  }

  let count = 0;
  for (const cid of contactIds) {
    try {
      const booking = await prisma.booking.findFirst({
        where: { tenantId, contactId: cid, status: { in: ["pending", "confirmed"] } },
        orderBy: { bookingDate: "asc" },
        include: { contact: true },
      });

      if (!booking || !booking.contact.waJid) continue;

      const dateStr = new Date(booking.bookingDate).toLocaleString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });

      const bodyText =
        `⏰ *Pengingat Jadwal Reservasi*\n\n` +
        `Halo *${booking.contact.name}*,\n` +
        `Sekadar mengingatkan jadwal reservasi *${booking.serviceName}* Anda pada *${dateStr}*.\n\n` +
        `📌 Mohon hadir 15 menit sebelum jam tindakan. Balas chat ini jika ingin mengubah jadwal ya. Terima kasih! 🙏`;

      await waManager.sendText(waSession.id, booking.contact.waJid, bodyText);

      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: new Date() },
      });

      count++;
    } catch {
      /* ignore single error */
    }
  }

  return {
    ok: true,
    executedCount: count,
    details: `${count} pengingat WhatsApp jadwal booking berhasil terkirim.`,
  };
}

/**
 * Execute Action: Midtrans QRIS Payment Links
 */
export async function executePaymentLinkAction(
  tenantId: string,
  contactIds: string[],
): Promise<ExecuteActionResult> {
  const waSession = await prisma.waSession.findFirst({
    where: { tenantId, status: "connected" },
  });

  if (!waSession) {
    return {
      ok: false,
      executedCount: 0,
      details: "Sesi WhatsApp belum terhubung.",
    };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { midtransServerKey: true, midtransIsProduction: true },
  });

  let count = 0;
  for (const cid of contactIds) {
    try {
      const order = await prisma.order.findFirst({
        where: { tenantId, contactId: cid, status: "draft" },
        orderBy: { createdAt: "desc" },
        include: { contact: true, items: { include: { product: true } } },
      });

      if (!order || !order.contact.waJid) continue;

      const midRes = await createMidtransTransaction({
        orderId: order.id,
        grossAmount: order.total,
        customerName: order.contact.name,
        customerPhone: order.contact.phone,
        items: order.items.map((it) => ({
          name: it.product.name,
          price: it.price,
          qty: it.qty,
        })),
        serverKey: tenant?.midtransServerKey || undefined,
        isProduction: tenant?.midtransIsProduction,
      });

      if (midRes.ok && midRes.redirectUrl) {
        const bodyText =
          `💳 *Tautan Pembayaran Resmi (QRIS / E-Wallet / VA)*\n\n` +
          `Halo *${order.contact.name}*,\n` +
          `Berikut tautan bayar instan untuk pesanan #${order.id.slice(-6).toUpperCase()} senilai *Rp ${order.total.toLocaleString("id-ID")}*:\n\n` +
          `🔗 ${midRes.redirectUrl}\n\n` +
          `_Scan QRIS / pilih cara bayar di atas untuk konfirmasi lunas otomatis 24 jam!_`;

        await waManager.sendText(waSession.id, order.contact.waJid, bodyText);
        count++;
      }
    } catch {
      /* ignore */
    }
  }

  return {
    ok: true,
    executedCount: count,
    details: `${count} link pembayaran QRIS Midtrans berhasil dikirimkan ke WhatsApp customer.`,
  };
}
