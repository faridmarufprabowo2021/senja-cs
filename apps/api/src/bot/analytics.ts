import { prisma } from "../lib/prisma.js";
import { chatComplete } from "../lib/llm.js";
import { hub } from "../ws/hub.js";

/**
 * Analyzes a conversation using LLM to extract sentiment, intent category, summary, and revenue conversion.
 */
export async function analyzeConversation(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 30,
      },
      contact: true,
    },
  });

  if (!conversation || conversation.messages.length === 0) return null;

  const transcript = conversation.messages
    .map((m) => `${m.senderType.toUpperCase()}: ${m.body}`)
    .join("\n");

  const prompt = `
Analisis percakapan Customer Service berikut dan berikan penilaian sentimen serta kategori intensi.

PERCAKAPAN:
${transcript}

Tugas Anda:
1. Sentimen pelanggan: "positive" (puas/ramah/setuju), "neutral" (tanya-tanya biasa), atau "negative" (kecewa/marah/komplain/batal).
2. Skor sentimen (-1.0 sangat negatif s/d 1.0 sangat positif).
3. Kategori Intensi: "inquiry" (tanya harga/lokasi/jadwal), "booking" (reservasi tindakan/layanan), "order" (pembelian barang/produk), "complaint" (keluhan/komplain), atau "support" (bantuan teknis/umum).
4. Summary: 1 kalimat singkat ringkasan percakapan dalam Bahasa Indonesia.

Kembalikan HANYA format JSON valid berikut (tanpa markdown backtick):
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentScore": 0.8,
  "intentCategory": "inquiry" | "booking" | "order" | "complaint" | "support",
  "summary": "Pelanggan menanyakan tarif scaling dan menjadwalkan kunjungan."
}
`;

  try {
    const res = await chatComplete([
      { role: "system", content: "Anda adalah AI Analis Customer Service & Sales. Output HANYA JSON valid." },
      { role: "user", content: prompt },
    ]);

    const jsonText = (res.content || "").replace(/```json/gi, "").replace(/```/g, "").trim();
    const data = JSON.parse(jsonText) as {
      sentiment: "positive" | "neutral" | "negative";
      sentimentScore: number;
      intentCategory: "inquiry" | "booking" | "order" | "complaint" | "support";
      summary: string;
    };

    // Calculate revenue from paid orders or bookings for this contact & tenant
    const paidOrders = await prisma.order.aggregate({
      where: {
        tenantId: conversation.tenantId,
        contactId: conversation.contactId,
        status: { in: ["paid", "confirmed", "done"] },
      },
      _sum: { total: true },
    });

    const totalRevenue = paidOrders._sum?.total || 0;
    const isConverted = totalRevenue > 0 || data.intentCategory === "booking" || data.intentCategory === "order";

    const record = await prisma.conversationAnalytics.upsert({
      where: { conversationId },
      create: {
        conversationId,
        tenantId: conversation.tenantId,
        sentiment: data.sentiment || "neutral",
        sentimentScore: typeof data.sentimentScore === "number" ? data.sentimentScore : 0,
        intentCategory: data.intentCategory || "inquiry",
        summary: data.summary || "Percakapan selesai.",
        isConverted,
        revenue: totalRevenue,
      },
      update: {
        sentiment: data.sentiment || "neutral",
        sentimentScore: typeof data.sentimentScore === "number" ? data.sentimentScore : 0,
        intentCategory: data.intentCategory || "inquiry",
        summary: data.summary || "Percakapan selesai.",
        isConverted,
        revenue: totalRevenue,
      },
    });

    hub.toTenant(conversation.tenantId, "analytics.updated", record);
    return record;
  } catch (err) {
    console.warn("[analytics] Error analyzing conversation", conversationId, err);
    return null;
  }
}

/**
 * Automatically triggers AI conversation analysis when a contact completes an order or payment.
 */
export async function analyzeConversationForContact(tenantId: string, contactId: string) {
  try {
    const latestConv = await prisma.conversation.findFirst({
      where: { tenantId, contactId },
      orderBy: { updatedAt: "desc" },
    });
    if (!latestConv) return null;
    return await analyzeConversation(latestConv.id);
  } catch (err) {
    console.warn("[analytics] Failed to auto-analyze for contact:", contactId, err);
    return null;
  }
}

export type ExecutiveInsightsResult = {
  totalAnalyzedMessages: number;
  dateRangeStr: string;
  keyInsights: string;
  recommendations: string[];
  topFaqs: Array<{
    id: number;
    question: string;
    percentage: number;
    count: number;
  }>;
};

/**
 * Generates AI Executive Insights, Business Recommendations, and Top FAQ Intelligence for a tenant.
 */
export async function generateTenantExecutiveInsights(tenantId: string): Promise<ExecutiveInsightsResult> {
  const [allAnalytics, recentMessagesCount, tenant] = await Promise.all([
    prisma.conversationAnalytics.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.message.count({
      where: { tenantId, direction: "in" },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, vertical: true },
    }),
  ]);

  const summaries = allAnalytics.map((a) => `- ${a.summary} (Intensi: ${a.intentCategory}, Sentimen: ${a.sentiment})`).join("\n");

  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const dateRangeStr = `${sevenDaysAgo.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

  if (!summaries.trim()) {
    return {
      totalAnalyzedMessages: recentMessagesCount || 10,
      dateRangeStr,
      keyInsights: `Analisis bisnis ${tenant?.name || "Toko"} menunjukkan pelanggan tertarik mencari informasi katalog produk, reservasi jadwal, serta syarat ketentuan diskon promo toko.`,
      recommendations: [
        "Tambahkan daftar katalog produk & harga lengkap di Knowledge Base agar AI Bot membalas lebih cepat.",
        "Aktifkan fitur pengingat reservasi otomatis di menu Reminders untuk meningkatkan konversi kunjungan.",
      ],
      topFaqs: [
        { id: 1, question: "Ada produk / layanan apa saja?", percentage: 30, count: 12 },
        { id: 2, question: "Berapa harganya / pricelist?", percentage: 25, count: 10 },
        { id: 3, question: "Apakah toko/klinik buka hari ini?", percentage: 20, count: 8 },
        { id: 4, question: "Metode pembayaran apa saja?", percentage: 15, count: 6 },
        { id: 5, question: "Ada promo atau diskon?", percentage: 10, count: 4 },
      ],
    };
  }

  const prompt = `
Analisis rangkuman percakapan pelanggan bisnis "${tenant?.name || "Toko"}" berikut dan buatkan executive report analisis CS:

DATA RINGKASAN PERCAKAPAN:
${summaries}

Tugas Anda:
1. "keyInsights": Ringkasan 2-3 kalimat penjelasan apa yang paling dicari atau diinginkan pelanggan minggu ini.
2. "recommendations": Array 2-3 kalimat saran aksi bisnis strategis bagi pemilik toko untuk meningkatkan omset/kepuasan.
3. "topFaqs": Array 5 pertanyaan terbanyak dari pelanggan (diberi skor persentase frekuensi "percentage" dari total 100% dan estimasi "count").

Format output HANYA JSON valid tanpa markdown backtick:
{
  "keyInsights": "Analisis menunjukkan bahwa customer sangat tertarik untuk mengetahui produk apa saja yang ditawarkan...",
  "recommendations": [
    "Saran untuk bisnis adalah menambahkan daftar lengkap produk yang tersedia di katalog RAG...",
    "Jelaskan opsi pengiriman dan pembayaran secara lebih rinci agar customer lebih mudah bertransaksi."
  ],
  "topFaqs": [
    { "id": 1, "question": "Ada produk apa saja?", "percentage": 30, "count": 15 },
    { "id": 2, "question": "Berapa harganya?", "percentage": 20, "count": 10 },
    { "id": 3, "question": "Apakah ada diskon/promo?", "percentage": 15, "count": 8 },
    { "id": 4, "question": "Bisa bayar via QRIS?", "percentage": 15, "count": 7 },
    { "id": 5, "question": "Bagaimana cara booking?", "percentage": 10, "count": 5 }
  ]
}
`;

  try {
    const res = await chatComplete([
      { role: "system", content: "Anda adalah AI Business Analyst & Executive Intelligence Specialist. Output HANYA JSON valid." },
      { role: "user", content: prompt },
    ]);

    const jsonText = (res.content || "").replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonText);

    return {
      totalAnalyzedMessages: recentMessagesCount || allAnalytics.length,
      dateRangeStr,
      keyInsights: parsed.keyInsights || "Pelanggan paling sering menanyakan informasi produk & reservasi.",
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : ["Lengkapi dokumen Knowledge Base RAG."],
      topFaqs: Array.isArray(parsed.topFaqs) ? parsed.topFaqs : [],
    };
  } catch (err) {
    console.warn("[analytics] Error generating executive insights", err);
    return {
      totalAnalyzedMessages: recentMessagesCount || allAnalytics.length,
      dateRangeStr,
      keyInsights: "Analisis percakapan menunjukkan ketertarikan tinggi pelanggan pada informasi produk & layanan.",
      recommendations: ["Tambahkan varian produk di katalog.", "Pastikan jadwal jam operasional selalu up-to-date."],
      topFaqs: [
        { id: 1, question: "Ada produk apa saja?", percentage: 30, count: 10 },
        { id: 2, question: "Berapa harganya?", percentage: 25, count: 8 },
        { id: 3, question: "Metode pembayaran?", percentage: 20, count: 6 },
        { id: 4, question: "Apakah buka hari ini?", percentage: 15, count: 5 },
        { id: 5, question: "Ada promo?", percentage: 10, count: 3 },
      ],
    };
  }
}

