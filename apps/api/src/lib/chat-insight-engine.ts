import { prisma } from "./prisma.js";
import { chatComplete } from "./llm.js";

export type SlaMetrics = {
  totalMessages: number;
  customerMessageCount: number;
  agentMessageCount: number;
  botMessageCount: number;
  medianResponseTimeSec: number;
  medianResponseTimeFormatted: string;
  slaStatus: "green" | "yellow" | "red";
  slaLabel: string;
};

export type AnalyticsInsight = {
  intentScore: number;
  funnelStage: string;
  personaTags: string[];
  desires: string[];
  unansweredQuestions: string[];
  objections: string[];
  smartReplyDraft: string;
};

export type ChatInsightResult = {
  slaMetrics: SlaMetrics;
  analyticsInsight: AnalyticsInsight;
};

/**
 * Calculates human CS vs AI response time SLA metrics for a conversation
 */
export async function calculateSlaMetrics(
  tenantId: string,
  conversationId: string,
): Promise<SlaMetrics> {
  const messages = await prisma.message.findMany({
    where: { tenantId, conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      direction: true,
      senderType: true,
      createdAt: true,
    },
  });

  const totalMessages = messages.length;
  let customerMessageCount = 0;
  let agentMessageCount = 0;
  let botMessageCount = 0;

  for (const m of messages) {
    if (m.senderType === "customer" || m.direction === "in") {
      customerMessageCount++;
    } else if (m.senderType === "system" || m.senderType === "bot") {
      botMessageCount++;
    } else {
      agentMessageCount++;
    }
  }

  // Calculate response times (delay from customer IN message to next agent OUT message)
  const responseTimesSec: number[] = [];
  let pendingCustomerTime: Date | null = null;

  for (const m of messages) {
    if (m.senderType === "customer" || m.direction === "in") {
      if (!pendingCustomerTime) {
        pendingCustomerTime = new Date(m.createdAt);
      }
    } else if (m.senderType === "agent" && pendingCustomerTime) {
      const diffSec = Math.max(0, Math.floor((new Date(m.createdAt).getTime() - pendingCustomerTime.getTime()) / 1000));
      responseTimesSec.push(diffSec);
      pendingCustomerTime = null;
    }
  }

  let medianSec = 0;
  if (responseTimesSec.length > 0) {
    responseTimesSec.sort((a, b) => a - b);
    const mid = Math.floor(responseTimesSec.length / 2);
    medianSec =
      responseTimesSec.length % 2 !== 0
        ? responseTimesSec[mid]
        : Math.floor((responseTimesSec[mid - 1] + responseTimesSec[mid]) / 2);
  }

  let formatted = "0m";
  if (medianSec < 60) {
    formatted = `${medianSec} detik`;
  } else if (medianSec < 3600) {
    formatted = `${Math.round(medianSec / 60)} menit`;
  } else {
    formatted = `${(medianSec / 3600).toFixed(1)} jam`;
  }

  let slaStatus: "green" | "yellow" | "red" = "green";
  let slaLabel = "Sesuai SLA (< 5m)";

  if (medianSec > 900) { // > 15 mins
    slaStatus = "red";
    slaLabel = "Melanggar SLA (> 15m)";
  } else if (medianSec > 300) { // > 5 mins
    slaStatus = "yellow";
    slaLabel = "Waspada (5-15m)";
  }

  return {
    totalMessages,
    customerMessageCount,
    agentMessageCount,
    botMessageCount,
    medianResponseTimeSec: medianSec,
    medianResponseTimeFormatted: formatted,
    slaStatus,
    slaLabel,
  };
}

/**
 * Extracts 360° buyer persona, unanswered questions, objections, and smart reply draft
 */
export async function extractChatInsights(
  tenantId: string,
  conversationId: string,
): Promise<AnalyticsInsight> {
  const conversation = await prisma.conversation.findFirst({
    where: { tenantId, id: conversationId },
    include: {
      contact: true,
      analytics: true,
    },
  });

  if (!conversation) {
    return {
      intentScore: 50,
      funnelStage: "Inquiry (Tanya-tanya)",
      personaTags: ["Inquisitive"],
      desires: [],
      unansweredQuestions: [],
      objections: [],
      smartReplyDraft: "Halo Kak, ada yang bisa kami bantu kembali?",
    };
  }

  // Fetch last 15 messages
  const recentMessages = await prisma.message.findMany({
    where: { tenantId, conversationId },
    take: 15,
    orderBy: { createdAt: "asc" },
    select: { senderType: true, direction: true, body: true, createdAt: true },
  });

  if (recentMessages.length === 0) {
    return {
      intentScore: 50,
      funnelStage: "Inquiry (Tanya-tanya)",
      personaTags: ["Inquisitive"],
      desires: [],
      unansweredQuestions: [],
      objections: [],
      smartReplyDraft: `Halo Kak ${conversation.contact.name || ""}, ada yang bisa kami bantu?`,
    };
  }

  const chatTranscript = recentMessages
    .map((m) => `${m.senderType === "customer" || m.direction === "in" ? "Customer" : "CS"}: ${m.body}`)
    .join("\n");

  const prompt = `Anda adalah "AI Sales Profiler & Customer Insight Engine".
Tugas Anda adalah membaca transkrip obrolan WhatsApp antara Customer "${conversation.contact.name || "Pelanggan"}" dan CS di bawah ini, lalu menganalisisnya secara tajam dalam format JSON persis.

TRANSKRIP CHAT:
${chatTranscript}

TUGAS ANDA — KELUARKAN HANYA JSON DENGAN STRUKTUR BERIKUT:
{
  "intentScore": 75, // Angka 0-100 (misal 80 jika berminat tinggi/HOT, 30 jika COLD)
  "funnelStage": "Menimbang (Evaluation)", // Pilihan: "Discovery", "Tanya-tanya (Inquiry)", "Menimbang (Evaluation)", "Siap Closing", "Converted/Lunas"
  "personaTags": ["Decisive", "Price-Sensitive"], // 1-3 tag karakter pembeli (pilihan: Decisive, Inquisitive, Price-Sensitive, Hesitant, Detail-Oriented, Impulsive)
  "desires": ["Ingin pengiriman hari ini", "Butuh garansi resmi"], // List 1-3 kebutuhan/keinginan pelanggan yang terdeteksi dari chat
  "unansweredQuestions": ["Apakah garansi berlaku jika kena air?"], // List pertanyaan spesifik customer yang BELUM dijawab oleh CS di bagian akhir chat (kosongkan jika semua sudah dijawab)
  "objections": ["Merasa biaya ongkos kirim agak mahal"], // List keraguan atau alasan customer batal/ragu membeli
  "smartReplyDraft": "Halo Kak Budi, mengenai garansi tetap berlaku ya selama..." // Draft balasan 2-3 kalimat yang sangat ramah, menjawab pertanyaan terlewat/keberatan customer, dan mengajak closing.
}

ATURAN: HANYA keluarkan JSON murni tanpa markdown wrapper atau teks penjelasan tambahan.`;

  try {
    const res = await chatComplete([{ role: "user", content: prompt }]);
    const jsonText = (res.content || "")
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/, "")
      .trim();

    const parsed = JSON.parse(jsonText);

    return {
      intentScore: Number(parsed.intentScore) || (conversation.analytics?.sentimentScore ? Math.round(conversation.analytics.sentimentScore * 100) : 60),
      funnelStage: parsed.funnelStage || "Menimbang-nimbang",
      personaTags: Array.isArray(parsed.personaTags) ? parsed.personaTags : ["Inquisitive"],
      desires: Array.isArray(parsed.desires) ? parsed.desires : [],
      unansweredQuestions: Array.isArray(parsed.unansweredQuestions) ? parsed.unansweredQuestions : [],
      objections: Array.isArray(parsed.objections) ? parsed.objections : [],
      smartReplyDraft: parsed.smartReplyDraft || `Halo Kak ${conversation.contact.name || ""}, ada yang bisa kami bantu kembali?`,
    };
  } catch (err) {
    console.warn("[chat-insight-engine] Error extracting LLM chat insights, using fallback", err);
    return {
      intentScore: conversation.analytics?.sentimentScore ? Math.round(conversation.analytics.sentimentScore * 100) : 65,
      funnelStage: conversation.analytics?.intentCategory === "order" ? "Siap Closing" : "Menimbang-nimbang",
      personaTags: ["Inquisitive"],
      desires: [],
      unansweredQuestions: [],
      objections: [],
      smartReplyDraft: `Halo Kak ${conversation.contact.name || ""}, apakah ada informasi produk yang ingin ditanyakan lagi? 😊`,
    };
  }
}

export async function getConversationInsights(
  tenantId: string,
  conversationId: string,
): Promise<ChatInsightResult> {
  const [slaMetrics, analyticsInsight] = await Promise.all([
    calculateSlaMetrics(tenantId, conversationId),
    extractChatInsights(tenantId, conversationId),
  ]);

  return {
    slaMetrics,
    analyticsInsight,
  };
}
