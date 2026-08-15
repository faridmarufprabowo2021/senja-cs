import { prisma } from "../lib/prisma.js";
import { hub } from "../ws/hub.js";
import { createAndEmitNotification } from "../lib/notifications.js";
import { mapConversation, mapMessage } from "../lib/mappers.js";
import { chatComplete } from "../lib/llm.js";
import { matchHandoverKeyword, matchSkill } from "./handoff.js";
import { isWithinBusinessHours } from "./hours.js";
import { allowBotReply } from "./rate-limit.js";
import { retrieveChunks } from "./retrieve.js";
import { waManager } from "../wa/manager.js";
import { SYSTEM_TOOLS_DEFINITIONS } from "../tools/schemas.js";
import {
  createOrderDraft,
  listProducts,
  getPaymentInfo,
  getOrderStatus,
  cancelBookingOrOrderTool,
  getProductRecommendationTool,
} from "../tools/commerce.js";
import { runFlowForConversation } from "./flow-runner.js";
import { createBookingDraft } from "../tools/booking.js";
import { getCachedBotSettings } from "../lib/bot-settings-cache.js";

const pending = new Map<string, NodeJS.Timeout>();

/** Debounce bot reply per conversation (burst messages). */
export function scheduleBotReply(conversationId: string, delayMs = 1200) {
  const prev = pending.get(conversationId);
  if (prev) clearTimeout(prev);
  const t = setTimeout(() => {
    pending.delete(conversationId);
    void runBotReply(conversationId).catch((err) => {
      console.error("bot reply failed", conversationId, err);
    });
  }, delayMs);
  pending.set(conversationId, t);
}

export async function runBotReply(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true, assignee: true },
  });
  if (!conversation) return;
  if (conversation.status === "assigned" || conversation.status === "resolved") {
    return;
  }

  const settings = await getCachedBotSettings(conversation.tenantId);
  if (!settings.enabled) return;
  if (!allowBotReply(conversation.tenantId)) {
    console.warn("bot rate limit", conversation.tenantId);
    return;
  }
  if (conversation.mode !== "bot") {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { mode: "bot", status: "bot_active" },
    });
  }

  const recent = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const chronological = [...recent].reverse();
  const lastIn = [...chronological]
    .reverse()
    .find((m) => m.direction === "in" && m.senderType === "customer");
  if (!lastIn) return;
  const lastInMeta = (lastIn.metadata as Record<string, any>) || {};
  const effectiveUserText = (lastInMeta.transcript || lastInMeta.imageAnalysis || lastIn.body || "").trim();

  const alreadyReplied = chronological.some(
    (m) =>
      m.senderType === "bot" &&
      m.createdAt > lastIn.createdAt,
  );
  if (alreadyReplied) return;

  // Execute active ConversationFlow if defined
  const flowResult = await runFlowForConversation(conversation.id, effectiveUserText);
  if (flowResult.handled) {
    return;
  }

  const open = isWithinBusinessHours({
    enabled: settings.businessHoursEnabled,
    start: settings.businessHoursStart,
    end: settings.businessHoursEnd,
    tz: settings.businessHoursTz,
  });
  if (!open) {
    const alreadyAway = chronological.some(
      (m) =>
        m.senderType === "bot" &&
        typeof m.metadata === "object" &&
        m.metadata !== null &&
        (m.metadata as { away?: boolean }).away === true,
    );
    if (!alreadyAway) {
      await sendBotMessage(conversation.id, settings.awayMessage, {
        away: true,
      });
    }
    return;
  }

  const botTurns = chronological.filter((m) => m.senderType === "bot").length;
  if (botTurns >= settings.maxBotTurns) {
    await escalate(
      conversation.id,
      "Batas balasan bot tercapai. Menghubungkan ke agent…",
      { escalateReason: "max_turns", preferredRole: "agent" },
    );
    return;
  }

  // Fetch active AI Agents for this tenant (AI Orchestrator Engine)
  const allActiveAgents = await prisma.aiAgent.findMany({
    where: {
      tenantId: conversation.tenantId,
      enabled: true,
    },
    include: { knowledgeDocs: true },
  });

  // 1. Session & Channel Binding Match
  let activeAgent = allActiveAgents.find(
    (a) => a.waSessionId === conversation.waSessionId && a.waSessionId !== null,
  );
  if (!activeAgent && conversation.channel && conversation.channel !== "all") {
    activeAgent = allActiveAgents.find((a) => a.channel === conversation.channel);
  }

  // 2. AI Orchestrator Intent Match if multiple agents exist
  const userMessageText = effectiveUserText;
  if (!activeAgent && allActiveAgents.length > 1) {
    const lower = userMessageText.toLowerCase();
    activeAgent = allActiveAgents.find((a) => {
      const descMatch =
        a.description &&
        lower.split(" ").some((word: string) => word.length > 3 && a.description.toLowerCase().includes(word));
      const kwMatch =
        a.handoverKeywords &&
        a.handoverKeywords.some((kw) => lower.includes(kw.toLowerCase()));
      return descMatch || kwMatch;
    });
  }

  // 3. Fallback to Default Agent or first available Agent
  if (!activeAgent) {
    activeAgent = allActiveAgents.find((a) => a.isDefault) || allActiveAgents[0] || null;
  }

  // Persist assigned aiAgentId if changed
  if (activeAgent && conversation.aiAgentId !== activeAgent.id) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { aiAgentId: activeAgent.id },
    });
  }

  const handoverKeywordsToUse = activeAgent?.handoverKeywords || settings.handoverKeywords;
  const systemPromptToUse = activeAgent?.systemPrompt || settings.systemPrompt;
  const transferConditionsToUse = activeAgent?.transferConditions || null;

  const body = effectiveUserText;
  const kw = matchHandoverKeyword(body, handoverKeywordsToUse);
  if (kw) {
    await escalate(
      conversation.id,
      "Baik, kami hubungkan ke tim customer service ya…",
      { escalateReason: "keyword", preferredRole: "agent", skill: kw },
    );
    return;
  }

  // Fast-path intent router for exact simple keywords (katalog, rekening, status, cara bayar)
  const tenant = await prisma.tenant.findUnique({
    where: { id: conversation.tenantId },
  });
  if (tenant) {
    const { tryCommerceTools } = await import("../tools/commerce.js");
    const tool = await tryCommerceTools({
      tenantId: conversation.tenantId,
      contactId: conversation.contactId,
      text: body,
    });
    if (tool) {
      await sendBotMessage(conversation.id, tool.text, {
        tool: "commerce_fastpath",
        confidence: tool.ok ? 0.95 : 0.4,
      });
      return;
    }
  }

  const chunks = await retrieveChunks(conversation.tenantId, body, 5);
  const best = chunks[0]?.score ?? 0;

  // Only escalate to human team if Knowledge Base has NO relevant info AND matching a skill/emergency route
  if (best < 0.15) {
    const skill = matchSkill(body);
    if (skill) {
      await escalate(
        conversation.id,
        `Baik, kami teruskan ke tim ${skill.label.toLowerCase()} ya…`,
        {
          escalateReason: "skill_route",
          preferredRole: skill.preferredRole,
          skill: skill.skill,
        },
      );
      return;
    }
  }

  const useChunks = chunks.slice(0, 5);

  const context = useChunks
    .map((c, i) => `[${i + 1}] (${c.title}, score=${c.score.toFixed(2)})\n${c.content}`)
    .join("\n---\n");
  const history = chronological
    .slice(-8)
    .map((m) => `${m.senderType}: ${m.body}`)
    .join("\n");

  const model =
    !settings.model ||
    settings.model.includes("gpt-4o") ||
    settings.model === "gpt-4o-mini"
      ? undefined
      : settings.model;

  const tz = settings.businessHoursTz || "Asia/Jakarta";
  const now = new Date();

  // Helper to format ISO date YYYY-MM-DD in target timezone
  function getIsoInTz(d: Date, timeZone: string) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      const year = parts.find((p) => p.type === "year")?.value;
      const month = parts.find((p) => p.type === "month")?.value;
      const day = parts.find((p) => p.type === "day")?.value;
      return `${year}-${month}-${day}`;
    } catch {
      return d.toISOString().split("T")[0];
    }
  }

  const isoToday = getIsoInTz(now, tz);
  let formattedCurrentDate = "";
  try {
    formattedCurrentDate = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: tz,
    }).format(now);
  } catch {
    formattedCurrentDate = isoToday;
  }

  let currentTimeStr = "";
  try {
    currentTimeStr = now.toLocaleTimeString("id-ID", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  } catch {
    currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  // Generate explicit 14-day calendar lookup table with explicit day-of-week & "minggu depan" labels
  const calendarRows: string[] = [];
  const startDayOfWeek = now.getDay(); // 0 = Minggu, 1 = Senin, 2 = Selasa, ...

  for (let i = 0; i <= 14; i++) {
    // Construct local date safely to avoid timezone rollover
    const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12, 0, 0);
    const fIso = getIsoInTz(futureDate, tz);
    let fFull = fIso;
    try {
      fFull = new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: tz,
      }).format(futureDate);
    } catch {}

    const dayOfWeek = futureDate.getDay();
    let relativeTag = "";
    if (i === 0) relativeTag = " [HARI INI]";
    else if (i === 1) relativeTag = " [BESOK]";
    else if (i === 2) relativeTag = " [LUSA]";

    let weekTag = "";
    if (i > 0) {
      if (dayOfWeek <= startDayOfWeek && i >= 6) {
        weekTag = " (MINGGU DEPAN)";
      } else if (i >= 7) {
        weekTag = " (MINGGU DEPAN)";
      } else if (dayOfWeek < startDayOfWeek) {
        weekTag = " (MINGGU DEPAN)";
      } else {
        weekTag = " (MINGGU INI)";
      }
    }

    calendarRows.push(`- ${fFull}${relativeTag}${weekTag} → ISO: ${fIso}`);
  }
  const calendarTable = calendarRows.join("\n");

  // Fetch real customer existing bookings & orders
  const [existingBookings, existingOrders, recentCorrections] = await Promise.all([
    prisma.booking.findMany({
      where: {
        tenantId: conversation.tenantId,
        contactId: conversation.contactId,
      },
      orderBy: { bookingDate: "desc" },
      take: 5,
    }),
    prisma.order.findMany({
      where: {
        tenantId: conversation.tenantId,
        contactId: conversation.contactId,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.aiCorrection.findMany({
      where: { tenantId: conversation.tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const bookingSummary = existingBookings.length > 0
    ? existingBookings
        .map(
          (b) =>
            `• ID: ${b.id} | Layanan: "${b.serviceName}" | Waktu: ${b.bookingDate.toLocaleString("id-ID", { timeZone: tz })} | Status: ${b.status}${b.note ? ` | Catatan: ${b.note}` : ""}`,
        )
        .join("\n")
    : "(Pelanggan ini belum memiliki riwayat reservasi/booking di database)";

  const orderSummary = existingOrders.length > 0
    ? existingOrders
        .map(
          (o) =>
            `• Order ID: ${o.id} | Total: Rp${o.total.toLocaleString("id-ID")} | Status: ${o.status}`,
        )
        .join("\n")
    : "(Pelanggan ini belum memiliki riwayat order/pesanan di database)";

  const correctionContext = recentCorrections.length
    ? "\n\nKOREKSI & INSTRUKSI TERBARU DARI SUPERVISOR:\n" +
      recentCorrections
        .map(
          (c) =>
            `• Jika ditanya hal terkait: "${c.userQuery}" → JAWABAN BENAR: "${c.correctedReply}"`,
        )
        .join("\n")
    : "";

  const mediaUrl =
    lastIn.metadata && typeof lastIn.metadata === "object"
      ? (lastIn.metadata as any).mediaUrl || (lastIn.metadata as any).url || (lastIn.metadata as any).imageUrl
      : null;

  const userContentPayload: any = mediaUrl
    ? [
        { type: "text", text: body || "Pelanggan mengirimkan gambar ini. Mohon amati dan sebutkan jenis produk/roti ini lalu cek katalog." },
        { type: "image_url", image_url: { url: mediaUrl } },
      ]
    : body;

  const res = await chatComplete(
    [
      {
        role: "system",
        content: `${systemPromptToUse}

NAMA AGENT AI: ${activeAgent?.name || "CS Agent"}
${transferConditionsToUse ? `ATURAN PENGALIHAN KE CS MANUSIA: ${transferConditionsToUse}\n` : ""}
Business: ${tenant?.name ?? "Toko / Usaha"} (Vertical: ${tenant?.vertical ?? "commerce"})

WAKTU & TANGGAL HARI INI (REALTIME):
- Hari & Tanggal Lengkap: ${formattedCurrentDate}
- Tanggal ISO Hari Ini: ${isoToday}
- Jam Sekarang: ${currentTimeStr} WIB (${tz})

TABEL REFERENSI TANGGAL MINGGU INI (GUNAKAN INI UNTUK MENENTUKAN HARI/TANGGAL PASTI):
${calendarTable}

DATA REALTIME PELANGGAN INI (${conversation.contact.name} - ${conversation.contact.phone}):
[RESERVASI / BOOKING AKTIF]:
${bookingSummary}

[PESANAN / ORDER TERAKHIR]:
${orderSummary}

Context Knowledge:
${context || "(tidak ada)"}${correctionContext}

History Chat:
${history}

ATURAN PENTING & INTEGRASI AKSES DATA:
- DILARANG KERAS pernah mengatakan "Saya tidak memiliki akses ke data reservasi" ATAU "Setiap sesi konsultasi dimulai dari awal tanpa menyimpan informasi". ANDA MEMILIKI AKSES PENUH ke data reservasi & pesanan di atas!
- 🚚 HARGA ONGKIR (CEK ONGKIR): Jika pelanggan menanyakan biaya/ongkos kirim atau bertanya "ongkir ke [kota/kecamatan] berapa", PANGGIL TOOL \`check_shipping_cost\` dengan nama kota/kecamatan tujuan tersebut!
- 📦 CEK RESI / LACAK PAKET: Jika pelanggan menanyakan posisi paket atau mengirimkan nomor resi (misal: "cek resi JNE123456" atau "paket saya sudah sampai mana"), PANGGIL TOOL \`track_shipment\` dengan nomor resi tersebut!
- ❌ PEMBATALAN MANDIRI (BATAL BOOKING / PESANAN): Jika pelanggan meminta membatalkan reservasi atau pesanan (misal: "batalin booking saya", "saya mau batalkan pesanan"), PANGGIL TOOL \`cancel_booking_or_order\`!
- 🎁 REKOMENDASI BUDGET & HAMPERS: Jika pelanggan mencari rekomendasi sesuai budget/anggaran (misal: "rekomendasi hampers 100rb", "ada kado budget 50rb?"), PANGGIL TOOL \`get_product_recommendation\` dengan \`maxPrice\` yang diminta!
- 🖼️ FOTO PRODUK: Jika pelanggan meminta foto produk (misal: "minta foto roti abon", "boleh lihat fotonya?"), PANGGIL TOOL \`check_catalog\` atau \`get_product_recommendation\` dan lampirkan URL foto \`[Foto: URL]\` dalam balasan secara jelas!
- 📸 ANALISA FOTO / GAMBAR PRODUK (MISAL ROTI/MAKANAN/BARANG): Jika pelanggan mengirimkan gambar/foto produk: (1) Amati visualnya dan identifikasi jenis produk/roti tersebut. (2) PANGGIL TOOL \`check_catalog\` dengan kata kunci produk tersebut untuk cek ketersediaan harga & stok di katalog. (3) Informasikan ke pelanggan secara ramah dan tawarkan pemesanan!
- Jika pelanggan menanyakan "apakah booking saya sudah terdaftar", "cek bookingan saya", atau menanyakan status jadwal mereka, periksa [RESERVASI / BOOKING AKTIF] di atas dan jawab dengan detail tepat (layanan, tanggal, jam, status).
- ⚠️ JIKA PELANGGAN INGIN RESCHEDULE / GESER JADWAL / GANTI LAYANAN: PANGGIL TOOL \`reschedule_booking\` dengan tanggal/jam baru dan nama layanan baru (\`newServiceName\`) jika pelanggan juga mengganti jenis tindakan/layanan! DILARANG KERAS mengalihkan ke agen CS jika pelanggan hanya berniat reschedule atau ganti layanan!
- ⚠️ PERHATIKAN NAMA HARI DI TABEL REFERENSI TANGGAL DI ATAS! DILARANG menambah +7 hari secara asal untuk "minggu depan". Selalu cari baris di TABEL yang memiliki NAMA HARI yang diminta pelanggan (misal: cari baris "Senin" yang berlabel "(MINGGU DEPAN)" untuk "Senin minggu depan").
- Saat memanggil \`create_booking\` atau \`reschedule_booking\`, format \`bookingDateStr\` / \`newBookingDateStr\` sebagai tanggal & jam lengkap (cth: "2026-08-17 14:00").
- Jawab natural, ramah, singkat, Bahasa Indonesia.`,
      },
      { role: "user", content: userContentPayload },
    ],
    model,
    SYSTEM_TOOLS_DEFINITIONS,
  );

  // If LLM invoked tool calls, execute them safely
  if (res.toolCalls && res.toolCalls.length > 0) {
    try {
      for (const toolCall of res.toolCalls) {
        const fnName = toolCall.function.name;
        let args: any = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          /* invalid json */
        }

        if (fnName === "create_order" && args.items?.length) {
          const orderRes = await createOrderDraft(
            conversation.tenantId,
            conversation.contactId,
            args.items,
            args.note || "",
          );
          await sendBotMessage(conversation.id, orderRes.text, {
            tool: "create_order",
            confidence: 0.98,
          });
          return;
        }

        if (fnName === "create_booking" && args.serviceName) {
          const bookingRes = await createBookingDraft(
            conversation.tenantId,
            conversation.contactId,
            {
              serviceName: args.serviceName,
              bookingDateStr: args.bookingDateStr,
              note: args.note || "",
            },
          );
          await sendBotMessage(conversation.id, bookingRes.text, {
            tool: "create_booking",
            confidence: 0.98,
          });
          return;
        }

        if (fnName === "reschedule_booking" && args.newBookingDateStr) {
          const { rescheduleBooking } = await import("../tools/booking.js");
          const rescheduleRes = await rescheduleBooking(
            conversation.tenantId,
            conversation.contactId,
            {
              bookingId: args.bookingId,
              newBookingDateStr: args.newBookingDateStr,
              newServiceName: args.newServiceName,
              reason: args.reason,
            },
          );
          await sendBotMessage(conversation.id, rescheduleRes.text, {
            tool: "reschedule_booking",
            confidence: 0.98,
          });
          return;
        }

        if (fnName === "check_shipping_cost" && args.destination) {
          const { calculateShippingTool } = await import("../tools/shipping.js");
          const shipRes = await calculateShippingTool({
            destination: args.destination,
            weightGrams: args.weightGrams || 1000,
            courier: args.courier,
            origin: settings?.shippingOrigin,
          });
          await sendBotMessage(conversation.id, shipRes.text, {
            tool: "check_shipping_cost",
            confidence: 0.98,
          });
          return;
        }

        if (fnName === "track_shipment" && args.waybillNumber) {
          const { trackShipmentTool } = await import("../tools/shipping.js");
          const trackRes = await trackShipmentTool({
            waybillNumber: args.waybillNumber,
            courier: args.courier,
          });
          await sendBotMessage(conversation.id, trackRes.text, {
            tool: "track_shipment",
            confidence: 0.98,
          });
          return;
        }

        if (fnName === "check_promo_discounts") {
          const { checkPromoDiscountsTool } = await import("../tools/engagement.js");
          const promoRes = await checkPromoDiscountsTool({
            tenantId: conversation.tenantId,
            category: args.category,
          });
          await sendBotMessage(conversation.id, promoRes.text, {
            tool: "check_promo_discounts",
            confidence: 0.98,
          });
          return;
        }

        if (fnName === "check_invoice_status") {
          const { checkInvoiceStatusTool } = await import("../tools/engagement.js");
          const invRes = await checkInvoiceStatusTool({
            tenantId: conversation.tenantId,
            contactId: conversation.contactId || undefined,
            invoiceNumber: args.invoiceNumber,
          });
          await sendBotMessage(conversation.id, invRes.text, {
            tool: "check_invoice_status",
            confidence: 0.98,
          });
          return;
        }

        if (fnName === "collect_feedback_review" && args.rating) {
          const { collectFeedbackReviewTool } = await import("../tools/engagement.js");
          const revRes = await collectFeedbackReviewTool({
            tenantId: conversation.tenantId,
            conversationId: conversation.id,
            rating: Number(args.rating) || 5,
            reviewText: args.reviewText,
          });
          await sendBotMessage(conversation.id, revRes.text, {
            tool: "collect_feedback_review",
            confidence: 0.98,
          });
          return;
        }

        if (fnName === "create_payment_qris_link" && args.productName && args.amount) {
          const { createPaymentQrisLinkTool } = await import("../tools/engagement.js");
          const qrisRes = await createPaymentQrisLinkTool({
            tenantId: conversation.tenantId,
            productName: String(args.productName),
            amount: Number(args.amount) || 10000,
            qty: Number(args.qty) || 1,
            customerName: conversation.contact?.name || args.customerName || undefined,
            customerPhone: conversation.contact?.phone || undefined,
          });
          await sendBotMessage(conversation.id, qrisRes.text, {
            tool: "create_payment_qris_link",
            confidence: 0.98,
          });
          return;
        }

        if (fnName === "check_catalog") {
          const catRes = await listProducts(conversation.tenantId, args.query);
          await sendBotMessage(conversation.id, catRes.text, {
            tool: "check_catalog",
            confidence: 0.9,
          });
          return;
        }

        if (fnName === "get_payment_info") {
          const payRes = await getPaymentInfo(conversation.tenantId);
          await sendBotMessage(conversation.id, payRes.text, {
            tool: "get_payment_info",
            confidence: 0.9,
          });
          return;
        }

        if (fnName === "get_order_status") {
          const statusRes = await getOrderStatus(
            conversation.tenantId,
            conversation.contactId,
          );
          await sendBotMessage(conversation.id, statusRes.text, {
            tool: "get_order_status",
            confidence: 0.9,
          });
          return;
        }

        if (fnName === "cancel_booking_or_order") {
          const cancelRes = await cancelBookingOrOrderTool(
            conversation.tenantId,
            conversation.contactId,
            args.targetType,
            args.reason,
          );
          await sendBotMessage(conversation.id, cancelRes.text, {
            tool: "cancel_booking_or_order",
            confidence: 0.98,
          });
          return;
        }

        if (fnName === "get_product_recommendation") {
          const recRes = await getProductRecommendationTool(
            conversation.tenantId,
            args.maxPrice,
            args.category,
            args.occasion,
          );
          await sendBotMessage(conversation.id, recRes.text, {
            tool: "get_product_recommendation",
            confidence: 0.95,
          });
          return;
        }
      }
    } catch (err) {
      console.error("tool execution error, falling back to LLM content", err);
    }
  }

  const finalAnswer =
    res.content ||
    "Maaf, saya tidak mengerti. Silakan ketik *katalog*, *pesan*, atau *cs* untuk agen.";

  const aiSourceChunks = useChunks
    .filter((c) => c.score > 0)
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      documentId: c.documentId,
      title: c.title,
      score: c.score,
      snippet: c.content,
      fileUrl: c.fileUrl,
    }));

  await sendBotMessage(conversation.id, finalAnswer, {
    confidence: best,
    citations: useChunks
      .filter((c) => c.score > 0)
      .slice(0, 3)
      .map((c) => ({ title: c.title, score: c.score })),
    aiSource: {
      query: body,
      engine: "pgvector HNSW (Cosine Similarity)",
      retrievedAt: new Date().toISOString(),
      chunks: aiSourceChunks,
    },
  });
}

/** Hard handover to human. Soft answers stay in bot mode. */
async function escalate(
  conversationId: string,
  softMessage: string,
  meta?: {
    confidence?: number;
    citations?: { title: string; score: number }[];
    escalateReason?: string;
    preferredRole?: "admin" | "agent";
    skill?: string;
  },
) {
  await sendBotMessage(conversationId, softMessage, {
    confidence: meta?.confidence,
    citations: meta?.citations,
    escalated: true,
    escalateReason: meta?.escalateReason,
    preferredRole: meta?.preferredRole,
    skill: meta?.skill,
  });

  const reasonNote = [
    meta?.escalateReason ? `alasan: ${meta.escalateReason}` : null,
    meta?.skill ? `skill: ${meta.skill}` : null,
    meta?.preferredRole ? `saran: ${meta.preferredRole}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (conversation && reasonNote) {
    await prisma.message.create({
      data: {
        tenantId: conversation.tenantId,
        conversationId,
        direction: "out",
        senderType: "system",
        type: "system",
        body: `Handoff · ${reasonNote}`,
        metadata: {
          escalateReason: meta?.escalateReason,
          preferredRole: meta?.preferredRole,
          skill: meta?.skill,
        },
      },
    });
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: "waiting_agent",
      mode: "human",
    },
    include: { contact: true, assignee: true },
  });

  hub.toTenant(updated.tenantId, "conversation.updated", mapConversation(updated));

  // Emit urgent real-time notification to CS Agents & Admin
  void createAndEmitNotification({
    tenantId: updated.tenantId,
    type: "ai_handover",
    title: "⚠️ Handover Bot AI",
    message: `Obrolan ${updated.contact.name || updated.contact.phone} dialihkan ke Agen CS! Alasan: ${meta?.escalateReason || "Manual / Complaint"}`,
    link: `/inbox?cid=${updated.id}`,
    metadata: {
      conversationId: updated.id,
      contactName: updated.contact.name,
      contactPhone: updated.contact.phone,
      reason: meta?.escalateReason,
    },
  });
}

export async function sendBotMessage(
  conversationId: string,
  text: string,
  metadata: Record<string, unknown>,
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true },
  });
  if (!conversation) return;

  // Clean text message for customer (strip internal raw media URLs)
  const cleanedText = text
    .replace(/\[Foto:\s*https?:\/\/[^\]]+\]/gi, "")
    .replace(/\[Video:\s*https?:\/\/[^\]]+\]/gi, "")
    .replace(/https?:\/\/localhost:\d+\/api\/v1\/media\/[^\s\)]+/gi, "")
    .trim();

  let waMessageId: string | undefined;
  if (conversation.waSessionId && conversation.contact.waJid) {
    try {
      const sent = await waManager.sendText(
        conversation.waSessionId,
        conversation.contact.waJid,
        cleanedText || text,
      );
      waMessageId = sent?.key?.id ?? undefined;

      // Clear "mengetik..." presence indicator after reply is sent
      void waManager.sendPresence(conversation.waSessionId, conversation.contact.waJid, "paused");

      // Auto-send product media if product image exists
      const products = await prisma.product.findMany({
        where: { tenantId: conversation.tenantId, imageUrl: { not: null } },
        take: 10,
      });
      const matchedProd = products.find((p) => p.imageUrl && text.toLowerCase().includes(p.name.toLowerCase()));

      // Auto-send Knowledge Base Image Media if Knowledge Image exists
      const kbImages = await prisma.knowledgeDocument.findMany({
        where: { tenantId: conversation.tenantId, OR: [{ sourceType: "image" }, { imageUrl: { not: null } }] },
        take: 10,
      });
      const matchedKbImg = kbImages.find(
        (img) =>
          img.imageUrl &&
          (text.includes(img.imageUrl) ||
            (img.imageName && text.toLowerCase().includes(img.imageName.toLowerCase())) ||
            text.toLowerCase().includes("foto") ||
            text.toLowerCase().includes("brosur") ||
            text.toLowerCase().includes("gambar")),
      );

      const targetImageUrl = matchedKbImg?.imageUrl || matchedProd?.imageUrl;
      const targetStorageKey = matchedKbImg?.storageKey;
      const targetCaption = matchedKbImg
        ? `🖼️ ${matchedKbImg.imageName || matchedKbImg.title}\n${matchedKbImg.imageCaption || ""}`
        : matchedProd
          ? `🖼️ Foto Produk: ${matchedProd.name}`
          : "";

      if (targetImageUrl || targetStorageKey) {
        try {
          let buf: Buffer | null = null;
          let mime = "image/jpeg";

          const fs = await import("node:fs");
          const pathMod = await import("node:path");
          const { env } = await import("../lib/env.js");

          // Option A: Try direct disk load if file stored locally
          const filename = targetStorageKey || (targetImageUrl ? targetImageUrl.split("/").pop() : null);
          if (filename) {
            const localPath = pathMod.join(env.STORAGE_LOCAL_PATH, filename);
            if (fs.existsSync(localPath)) {
              buf = fs.readFileSync(localPath);
              const ext = pathMod.extname(localPath).toLowerCase();
              if (ext === ".png") mime = "image/png";
              if (ext === ".webp") mime = "image/webp";
            }
          }

          // Option B: Network fetch fallback for external image URLs
          if (!buf && targetImageUrl) {
            const imgRes = await fetch(targetImageUrl);
            if (imgRes.ok) {
              buf = Buffer.from(await imgRes.arrayBuffer());
              mime = imgRes.headers.get("content-type") || "image/jpeg";
            }
          }

          if (buf) {
            await waManager.sendMedia(conversation.waSessionId, conversation.contact.waJid, {
              isImage: true,
              buffer: buf,
              caption: targetCaption.trim(),
              mimetype: mime,
              fileName: "knowledge-image.jpg",
            });
          }
        } catch (err) {
          console.warn("Media auto-send error:", err);
        }
      }

      // Auto-send Knowledge Base Video Media if Knowledge Video exists
      const kbVideos = await prisma.knowledgeDocument.findMany({
        where: { tenantId: conversation.tenantId, sourceType: "video" },
        take: 10,
      });

      const matchedKbVid = kbVideos.find(
        (vid) =>
          vid.fileUrl &&
          (text.includes(vid.fileUrl) ||
            text.includes(`[Video: ${vid.fileUrl}]`) ||
            (vid.imageName && text.toLowerCase().includes(vid.imageName.toLowerCase())) ||
            text.toLowerCase().includes("video")),
      );

      if (matchedKbVid && matchedKbVid.fileUrl) {
        try {
          let vidBuf: Buffer | null = null;
          let vidMime = "video/mp4";

          const fs = await import("node:fs");
          const pathMod = await import("node:path");
          const { env } = await import("../lib/env.js");

          const vidFilename = matchedKbVid.storageKey || matchedKbVid.fileUrl.split("/").pop();
          if (vidFilename) {
            const localPath = pathMod.join(env.STORAGE_LOCAL_PATH, vidFilename);
            if (fs.existsSync(localPath)) {
              vidBuf = fs.readFileSync(localPath);
              const ext = pathMod.extname(localPath).toLowerCase();
              if (ext === ".mov") vidMime = "video/quicktime";
              if (ext === ".webm") vidMime = "video/webm";
            }
          }

          if (!vidBuf && matchedKbVid.fileUrl) {
            const vidRes = await fetch(matchedKbVid.fileUrl);
            if (vidRes.ok) {
              vidBuf = Buffer.from(await vidRes.arrayBuffer());
              vidMime = vidRes.headers.get("content-type") || "video/mp4";
            }
          }

          if (vidBuf) {
            const vidCaption = `🎥 ${matchedKbVid.imageName || matchedKbVid.title}\n${matchedKbVid.imageCaption ? matchedKbVid.imageCaption.split(" | Petunjuk AI:")[0] : ""}`;
            await waManager.sendMedia(conversation.waSessionId, conversation.contact.waJid, {
              isVideo: true,
              buffer: vidBuf,
              caption: vidCaption.trim(),
              mimetype: vidMime,
              fileName: "knowledge-video.mp4",
            });
          }
        } catch (err) {
          console.warn("Video auto-send error:", err);
        }
      }
    } catch (err) {
      console.warn("bot WA send failed (still saving message)", err);
    }
  }

  const now = new Date();
  const message = await prisma.message.create({
    data: {
      tenantId: conversation.tenantId,
      conversationId,
      direction: "out",
      senderType: "bot",
      senderName: "Bot AI",
      type: "text",
      body: text,
      waMessageId: waMessageId ?? null,
      metadata: metadata as object,
    },
  });

  const full = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessagePreview: text.slice(0, 200),
      lastMessageAt: now,
      status:
        conversation.status === "waiting_agent"
          ? "waiting_agent"
          : "bot_active",
    },
    include: { contact: true, assignee: true, aiAgent: { select: { id: true, name: true } } },
  });

  hub.toTenant(conversation.tenantId, "message.created", mapMessage(message));
  hub.toTenant(conversation.tenantId, "conversation.updated", mapConversation(full));

  // Trigger AI Auto Pipeline Stage Classification (Asynchronous)
  const { autoClassifyAndMoveDeal } = await import("./pipeline-classifier.js");
  void autoClassifyAndMoveDeal(conversationId);
}
