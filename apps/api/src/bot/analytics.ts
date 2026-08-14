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
