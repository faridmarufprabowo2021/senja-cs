import { prisma } from "./prisma.js";
import { chatComplete } from "./llm.js";

export type RecommendedContact = {
  contactId: string;
  name: string;
  phone: string;
  intent: "hot" | "warm" | "cold" | "converted";
  reason: string;
  lastMessage?: string;
};

export type RecommendedAction = {
  id: string;
  actionType: "contextual_followup" | "send_booking_reminder" | "send_payment_link";
  title: string;
  description: string;
  targetContacts: { id: string; name: string; phone: string }[];
};

export type CrmCopilotAnalysisResult = {
  content: string;
  recommendations: RecommendedContact[];
  actions?: RecommendedAction[];
};

export async function aggregateCrmContext(tenantId: string) {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000);

  // 1. Tenant & Orders Summary
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, vertical: true },
  });

  const orders = await prisma.order.findMany({
    where: { tenantId },
    select: { status: true, total: true, createdAt: true },
  });

  const paidOrders = orders.filter((o) => o.status === "paid" || o.status === "done");
  const draftOrders = orders.filter((o) => o.status === "draft" || o.status === "confirmed");
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const potentialRevenue = draftOrders.reduce((sum, o) => sum + o.total, 0);

  // 2. Lead Sentiments & Intent Summary
  const analytics = await prisma.conversationAnalytics.findMany({
    where: { tenantId },
    select: { sentiment: true, intentCategory: true, isConverted: true },
  });

  const intentCounts = {
    hot: analytics.filter((a) => a.sentiment === "positive" || a.intentCategory === "order" || a.intentCategory === "booking").length,
    warm: analytics.filter((a) => a.sentiment === "neutral" || a.intentCategory === "inquiry").length,
    cold: analytics.filter((a) => a.sentiment === "negative" || a.intentCategory === "complaint").length,
    converted: analytics.filter((a) => a.isConverted).length,
  };

  // 3. Overdue & Unhandled Chats
  const overdueConversations = await prisma.conversation.findMany({
    where: {
      tenantId,
      status: { in: ["new", "waiting_agent", "assigned", "bot_active"] },
      lastMessageAt: { lte: twoHoursAgo },
    },
    include: {
      contact: true,
      analytics: true,
    },
    take: 10,
    orderBy: { lastMessageAt: "asc" },
  });

  // 4. Top HOT & WARM Leads for Recommendations
  const recentConversations = await prisma.conversation.findMany({
    where: { tenantId },
    take: 8,
    orderBy: { updatedAt: "desc" },
    include: {
      contact: true,
      analytics: true,
    },
  });

  const hotLeads: RecommendedContact[] = recentConversations
    .filter((c) => c.contact)
    .map((c) => {
      const intent: "hot" | "warm" | "cold" | "converted" = c.analytics?.isConverted
        ? "converted"
        : c.analytics?.sentiment === "positive" || c.analytics?.intentCategory === "order" || c.analytics?.intentCategory === "booking"
          ? "hot"
          : "warm";

      return {
        contactId: c.contact.id,
        name: c.contact.name || "Pelanggan",
        phone: c.contact.phone || "",
        intent,
        reason: intent === "hot" ? "Prospek sangat berminat (HOT) — Siap ditutup/closing" : "Sedang mempertimbangkan (WARM)",
        lastMessage: c.lastMessagePreview || "",
      };
    });

  // 5. Sample Recent Messages for Objections & Query Detection
  const recentMessages = await prisma.message.findMany({
    where: {
      tenantId,
      direction: "in",
    },
    take: 30,
    orderBy: { createdAt: "desc" },
    select: { body: true, createdAt: true },
  });

  return {
    tenantName: tenant?.name || "Toko",
    vertical: tenant?.vertical || "commerce",
    revenue: {
      totalRevenue,
      potentialRevenue,
      paidCount: paidOrders.length,
      draftCount: draftOrders.length,
    },
    intentCounts,
    overdueCount: overdueConversations.length,
    overdueList: overdueConversations.map((c) => ({
      contactId: c.contactId,
      name: c.contact.name,
      phone: c.contact.phone,
      lastMessage: c.lastMessagePreview,
      lastMessageAt: c.lastMessageAt,
    })),
    hotLeads,
    sampleCustomerMessages: recentMessages.map((m) => m.body).filter(Boolean),
  };
}

export async function runCrmCopilotAnalysis(opts: {
  tenantId: string;
  userPrompt: string;
  chatHistory?: { role: string; content: string }[];
}): Promise<CrmCopilotAnalysisResult> {
  const { tenantId, userPrompt, chatHistory = [] } = opts;

  // Aggregate real-time data snapshot
  const context = await aggregateCrmContext(tenantId);

  const systemPrompt = `Anda adalah "CRM Analis by AI" — Asisten Konsultasi Analis Bisnis Eksekutif untuk Pemilik Toko/Bisnis "${context.tenantName}".

Tugas Anda adalah membaca snapshot data CRM real-time di bawah ini dan memberikan jawaban analitis yang sangat tajam, solutif, dan profesional untuk pemilik bisnis dalam Bahasa Indonesia.

DATABASES SNAPSHOT REAL-TIME:
• Nama Toko: ${context.tenantName} (Vertical: ${context.vertical})
• Omset Terrealisasi (Lunas): Rp ${context.revenue.totalRevenue.toLocaleString("id-ID")} (${context.revenue.paidCount} transaksi)
• Potensi Omset Menunggu (Draft/Invoice): Rp ${context.revenue.potentialRevenue.toLocaleString("id-ID")} (${context.revenue.draftCount} invoice)
• Statistik Intent Customer: HOT = ${context.intentCounts.hot}, WARM = ${context.intentCounts.warm}, COLD = ${context.intentCounts.cold}, LUNAS/CONVERTED = ${context.intentCounts.converted}
• Chat Macet / Overdue (>2 jam tanpa balasan): ${context.overdueCount} percakapan
• Sampel Pertanyaan/Keberatan Pelanggan Terbaru:
${context.sampleCustomerMessages.slice(0, 15).map((msg, i) => `  ${i + 1}. "${msg}"`).join("\n") || "  (Belum ada data sampel)"}

Daftar HOT & WARM Leads Siap Follow-up:
${context.hotLeads.map((l) => `  - [${l.intent.toUpperCase()}] ${l.name} (${l.phone}): "${l.lastMessage}"`).join("\n") || "  (Belum ada HOT lead terdeteksi)"}

ATURAN STRICT FORMATTING PENULISAN:
1. Gunakan Markdown standar yang BERSIH & RAPI:
   - Gunakan \`**teks tebal**\` untuk penekanan/bold (JANGAN gunakan single asterisk \`*teks tebal*\` gaya WhatsApp).
   - Selalu beri spasi yang jelas antar kata dan angka (misal: "Untuk 3 customer", bukan "Untuk3 customer"; "potensi recover 4 leads", bukan "recover4leads").
   - Jangan menyambung dua kata tanpa spasi (misal: "database klinik", bukan "databaselinik").
2. Jika menyajikan TABEL MARKDOWN (misal daftar lead/prioritas):
   - Pastikan baris header dan baris pembatas \`| Nama | No HP | Status | Alasan | \` terpisah jelas di baris baru.
   - Pastikan pemisah \`|---|---|---|---|\` lengkap dan tidak terputus.
3. Struktur jawaban:
   - Berikan ringkasan eksekutif poin-poin utama terlebih dahulu.
   - Berikan rekomendasi langkah aksi konkret (Actionable Recommendations) berurutan (Priority 1, Priority 2, dst).
   - Jika ada data tabel kontak, sajikan dalam tabel Markdown yang rapi.`;

  const messagesPayload = [
    { role: "system" as const, content: systemPrompt },
    ...chatHistory.slice(-6).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userPrompt },
  ];

  // Construct structured actionable recommendations
  const actions: RecommendedAction[] = [];

  if (context.hotLeads.length > 0) {
    actions.push({
      id: "act-followup-personal",
      actionType: "contextual_followup",
      title: "Follow-Up Personal Berbasis Konteks Chat",
      description: `Kirim WA personal ke ${context.hotLeads.length} HOT/WARM leads berdasarkan riwayat percakapan sebelumnya & voucher promo aktif toko.`,
      targetContacts: context.hotLeads.map((l) => ({ id: l.contactId, name: l.name, phone: l.phone })),
    });
  }

  if (context.overdueCount > 0 && context.overdueList.length > 0) {
    actions.push({
      id: "act-overdue-remind",
      actionType: context.vertical === "booking" ? "send_booking_reminder" : "send_payment_link",
      title: context.vertical === "booking" ? "Kirim WA Pengingat Booking" : "Kirim Link Pembayaran QRIS",
      description: `Eksekusi pesan pengingat ke ${context.overdueList.length} chat yang macet > 2 jam.`,
      targetContacts: context.overdueList.map((o) => ({ id: o.contactId, name: o.name, phone: o.phone })),
    });
  }

  try {
    const res = await chatComplete(messagesPayload);
    const textContent = res.content || "Maaf, AI Copilot sedang memproses data. Silakan coba kembali.";

    return {
      content: textContent,
      recommendations: context.hotLeads,
      actions,
    };
  } catch (err) {
    console.error("[crm-copilot-engine] Error generating LLM analysis", err);
    return {
      content: "Mohon maaf, terjadi kendala saat menganalisis data CRM. Silakan coba beberapa saat lagi.",
      recommendations: context.hotLeads,
      actions,
    };
  }
}
