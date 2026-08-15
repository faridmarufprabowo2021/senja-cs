import { prisma } from "../lib/prisma.js";
import { generateTenantExecutiveInsights } from "../bot/analytics.js";
import { waManager } from "../wa/manager.js";

export async function generateDailyReportText(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  // 1. Fetch metrics
  const [totalChatsToday, newBookingsToday, rescheduledBookingsToday, ordersToday, analyticsToday] =
    await Promise.all([
      prisma.conversation.count({
        where: {
          tenantId,
          lastMessageAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.booking.count({
        where: {
          tenantId,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.booking.count({
        where: {
          tenantId,
          updatedAt: { gte: todayStart, lte: todayEnd },
          note: { contains: "[Reschedule:" },
        },
      }),
      prisma.order.findMany({
        where: {
          tenantId,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.conversationAnalytics.findMany({
        where: {
          tenantId,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

  const paidOrders = ordersToday.filter(
    (o) => o.status === ("paid" as any) || o.status === "done" || o.status === "confirmed",
  );
  const closingCount = paidOrders.length;
  const grossRevenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // 2. Fetch AI Insights (Top FAQs & Strategic Recommendations)
  const insights = await generateTenantExecutiveInsights(tenantId).catch(() => null);

  const formattedDate = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedRevenue = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(grossRevenue);

  // Format Top FAQs
  let faqText = "• Belum ada tren FAQ dominan hari ini";
  if (insights?.topFaqs && insights.topFaqs.length > 0) {
    faqText = insights.topFaqs
      .slice(0, 3)
      .map((f, i) => `${i + 1}. *${f.question}* (${f.percentage}% chat)`)
      .join("\n");
  }

  // Format Recommendations
  let recText = "• Pertahankan performa balasan cepat AI Bot hari ini!";
  if (insights?.recommendations && insights.recommendations.length > 0) {
    recText = insights.recommendations
      .slice(0, 2)
      .map((r) => `💡 ${r}`)
      .join("\n");
  }

  const positivePercent = analyticsToday.length
    ? Math.round(
        (analyticsToday.filter((a) => a.sentiment === "positive").length / analyticsToday.length) * 100,
      )
    : 95;

  return `📊 *SENJA CS — LAPORAN HARIAN EKSEKUTIF*
🏢 *${tenant?.name || "Toko / Usaha"}*
📅 *${formattedDate}*

📈 *METRIK UTAMA HARI INI:*
• Total Chat Aktif: *${totalChatsToday} Chat*
• Penjualan Closing: *${closingCount} Transaksi* (${formattedRevenue})
• Reservasi/Booking Baru: *${newBookingsToday} Jadwal*
• Reschedule Jadwal: *${rescheduledBookingsToday} Jadwal*
• Kepuasan Pelanggan: *${positivePercent}% Positif* 😊

🔝 *TOP 3 PERTANYAAN PELANGGAN (FAQ):*
${faqText}

🤖 *REKOMENDASI STRATEGIS AI:*
${recText}

_Diproses otomatis oleh Senja CS AI Agent Engine (Asia/Jakarta)_`;
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const cleanToken = botToken.trim();
    const cleanChatId = chatId.trim();

    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description || `Telegram API error status ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal terhubung ke Telegram API" };
  }
}

export async function dispatchDailyReport(tenantId: string): Promise<{ ok: boolean; message: string }> {
  const settings = await prisma.botSettings.findUnique({
    where: { tenantId },
  });

  if (!settings || settings.dailyReportEnabled === false) {
    return { ok: false, message: "Fitur laporan harian tidak diaktifkan" };
  }

  const reportText = await generateDailyReportText(tenantId);
  const channel = settings.dailyReportChannel || "telegram";
  const results: string[] = [];

  // 1. Dispatch via Telegram Bot
  if (channel === "telegram" || channel === "both") {
    if (settings.telegramBotToken && settings.telegramChatId) {
      const tgRes = await sendTelegramMessage(
        settings.telegramBotToken,
        settings.telegramChatId,
        reportText,
      );
      if (tgRes.ok) {
        results.push("Telegram Bot: Berhasil terkirim");
      } else {
        results.push(`Telegram Bot Gagal: ${tgRes.error}`);
      }
    } else {
      results.push("Telegram Bot: Token atau Chat ID belum diisi");
    }
  }

  // 2. Dispatch via WhatsApp Owner
  if (channel === "whatsapp" || channel === "both") {
    if (settings.ownerPhone) {
      try {
        const activeSession = await prisma.waSession.findFirst({
          where: { tenantId, status: "connected" },
        });

        if (activeSession) {
          const rawPhone = settings.ownerPhone.replace(/\D/g, "");
          const jid = `${rawPhone}@s.whatsapp.net`;
          await waManager.sendText(activeSession.id, jid, reportText);
          results.push("WhatsApp Owner: Berhasil terkirim");
        } else {
          results.push("WhatsApp Owner: Sesi WA belum terhubung");
        }
      } catch (waErr) {
        results.push(`WhatsApp Owner Gagal: ${waErr instanceof Error ? waErr.message : "Error WA"}`);
      }
    } else {
      results.push("WhatsApp Owner: Nomor WA Owner belum diisi");
    }
  }

  return {
    ok: results.some((r) => r.includes("Berhasil terkirim")),
    message: results.join(" | ") || "Laporan diproses",
  };
}
