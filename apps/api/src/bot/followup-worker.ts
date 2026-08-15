import { prisma } from "../lib/prisma.js";
import { sendBotMessage } from "./reply.js";
import { chatComplete } from "../lib/llm.js";

function isQuietHours(agent: {
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTz?: string;
}): boolean {
  if (!agent.quietHoursEnabled) return false;
  try {
    const tz = agent.quietHoursTz || "Asia/Jakarta";
    const nowStr = new Date().toLocaleTimeString("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
    }); // e.g. "23:15"
    const start = agent.quietHoursStart || "22:00";
    const end = agent.quietHoursEnd || "08:00";

    if (start < end) {
      return nowStr >= start && nowStr < end;
    }
    // Midnight span (e.g. 22:00 to 08:00)
    return nowStr >= start || nowStr < end;
  } catch {
    return false;
  }
}

export async function runFollowupCheck() {
  try {
    const activeAgents = await prisma.aiAgent.findMany({
      where: { followupEnabled: true, enabled: true },
    });

    if (!activeAgents.length) return;

    for (const agent of activeAgents) {
      // 1. Quiet Hours (DND) Check — Skip sending late night messages to prevent WhatsApp spam flags
      if (isQuietHours(agent)) {
        continue;
      }

      // --- STAGE 1 FOLLOW-UP (Short Delay e.g. 15-60 mins) ---
      const delayMinutes1 = agent.followupDelayMinutes || 15;
      const cutoffTime1 = new Date(Date.now() - delayMinutes1 * 60 * 1000);

      const stage1Convs = await prisma.conversation.findMany({
        where: {
          tenantId: agent.tenantId,
          mode: "bot",
          assignedTo: null, // Human Agent Guard — never follow-up if CS human agent is assigned
          status: { in: ["new", "bot_active"] },
          followupStageCount: 0,
          lastMessageAt: { lte: cutoffTime1 },
          ...(agent.waSessionId ? { waSessionId: agent.waSessionId } : {}),
          ...(agent.channel && agent.channel !== "all" ? { channel: agent.channel } : {}),
        },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 6 } },
        take: 10,
      });

      for (const conv of stage1Convs) {
        let followupText =
          agent.followupMessage ||
          "Halo Kak, apakah ada yang ingin ditanyakan lagi terkait pesanan/booking tadi? 😊 Kami siap bantu jika Kakak ingin lanjut.";

        // AI Personal Dynamic Generation
        if (agent.followupAiDynamic && conv.messages.length > 0) {
          try {
            const chatLog = conv.messages
              .reverse()
              .map((m) => `${m.senderType === "customer" ? "Pelanggan" : "Bot"}: ${m.body}`)
              .join("\n");

            const prompt = `Kamu adalah ${agent.name}. 
Berdasarkan percakapan terakhir dengan pelanggan berikut:
---
${chatLog}
---
Buatkan 1 pesan sapaan follow-up singkat (1-2 kalimat) yang ramah, alami, Bahasa Indonesia, dan mengacu pada topik/produk/booking yang tadi ditanyakan pelanggan. Ajak mereka mengonfirmasi kembali secara santun.`;

            const aiRes = await chatComplete(
              [{ role: "user", content: prompt }],
              agent.model,
            );
            if (aiRes.content?.trim()) {
              followupText = aiRes.content.trim();
            }
          } catch {
            /* fallback to static template */
          }
        }

        await prisma.conversation.update({
          where: { id: conv.id },
          data: { followupSentAt: new Date(), followupStageCount: 1 },
        });

        await sendBotMessage(conv.id, followupText, {
          tool: "auto_followup_stage1",
          agentId: agent.id,
        });
      }

      // --- STAGE 2 FOLLOW-UP (Longer Delay / Special Offer e.g. 24 hours) ---
      if (agent.followupStage2Enabled) {
        const delayMinutes2 = agent.followupStage2DelayMinutes || 1440;
        const cutoffTime2 = new Date(Date.now() - delayMinutes2 * 60 * 1000);

        const stage2Convs = await prisma.conversation.findMany({
          where: {
            tenantId: agent.tenantId,
            mode: "bot",
            assignedTo: null, // Human Agent Guard
            status: { in: ["new", "bot_active"] },
            followupStageCount: 1,
            lastMessageAt: { lte: cutoffTime2 },
            ...(agent.waSessionId ? { waSessionId: agent.waSessionId } : {}),
            ...(agent.channel && agent.channel !== "all" ? { channel: agent.channel } : {}),
          },
          include: { messages: { orderBy: { createdAt: "desc" }, take: 6 } },
          take: 10,
        });

        // Fetch active vouchers for dynamic promo injection
        const promos = await prisma.promoVoucher.findMany({
          where: { tenantId: agent.tenantId, active: true },
          take: 3,
        });
        const promoText = promos.length > 0
          ? `\nKode Promo Aktif: ` + promos.map(p => `${p.code} (Diskon ${p.discountPercent}%)`).join(", ")
          : "";

        for (const conv of stage2Convs) {
          let followupText =
            agent.followupStage2Message ||
            "Halo Kak, khusus hari ini kami ada penawaran spesial voucher diskon jika Kakak ingin menyelesaikan reservasi/pesanan kemarin. Mau kami bantu proses sekarang? 😊";

          if (agent.followupAiDynamic && conv.messages.length > 0) {
            try {
              const chatLog = conv.messages
                .reverse()
                .map((m) => `${m.senderType === "customer" ? "Pelanggan" : "Bot"}: ${m.body}`)
                .join("\n");

              const prompt = `Kamu adalah ${agent.name}. 
Berdasarkan percakapan kemarin berikut:
---
${chatLog}
---${promoText}
Buatkan 1 pesan follow-up Tahap 2 (Urgency & Special Promo) singkat (1-2 kalimat) yang memberikan penawaran voucher/diskon khusus agar pelanggan bersemangat menyelesaikan pesanan/booking kemarin.`;

              const aiRes = await chatComplete(
                [{ role: "user", content: prompt }],
                agent.model,
              );
              if (aiRes.content?.trim()) {
                followupText = aiRes.content.trim();
              }
            } catch {
              /* fallback */
            }
          }

          await prisma.conversation.update({
            where: { id: conv.id },
            data: { followupSentAt: new Date(), followupStageCount: 2 },
          });

          await sendBotMessage(conv.id, followupText, {
            tool: "auto_followup_stage2",
            agentId: agent.id,
          });
        }
      }

      // --- STAGE 3: AUTO-RESOLVE INACTIVE CONVERSATIONS (Older than 48 hours) ---
      const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await prisma.conversation.updateMany({
        where: {
          tenantId: agent.tenantId,
          mode: "bot",
          assignedTo: null,
          status: { in: ["new", "bot_active"] },
          followupStageCount: { gte: 1 },
          lastMessageAt: { lte: cutoff48h },
        },
        data: {
          status: "resolved",
          resolvedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.error("Error in runFollowupCheck:", err);
  }
}
