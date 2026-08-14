import { prisma } from "../lib/prisma.js";
import { chatComplete } from "../lib/llm.js";
import { ensureDefaultPipeline } from "../routes/pipeline.js";

export async function autoClassifyAndMoveDeal(conversationId: string) {
  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: "desc" }, take: 8 },
      },
    });

    if (!conv || !conv.contact) return;

    await ensureDefaultPipeline(conv.tenantId);

    const pipeline = await prisma.pipeline.findFirst({
      where: { tenantId: conv.tenantId },
      include: { stages: { orderBy: { orderIndex: "asc" } } },
    });

    if (!pipeline || !pipeline.stages.length) return;

    const chatHistory = conv.messages
      .reverse()
      .map((m) => `${m.senderType === "customer" ? "Pelanggan" : "Bot/CS"}: ${m.body}`)
      .join("\n");

    const stageDescriptions = pipeline.stages
      .map((s, idx) => `Stage ID "${s.id}": ${s.name} (order ${s.orderIndex})`)
      .join("\n");

    const systemPrompt = `Kamu adalah AI Sales Pipeline Classifier.
Tugasmu adalah menganalisis riwayat obrolan pelanggan dan menentukan TEPAT 1 Stage ID terbaik dari daftar berikut yang menggambarkan posisi pelanggan saat ini.

DAFTAR STAGE PIPELINE:
${stageDescriptions}

ATURAN KLASIFIKASI:
- Jika baru sapaan awal atau tanya umum -> Pilih Stage "1. Lead Masuk"
- Jika bertanya spesifikasi/ukuran/lokasi/opsi -> Pilih Stage "2. Kualifikasi"
- Jika menanyakan harga total, invoice, nomor rekening, atau ongkir -> Pilih Stage "3. Proposal / Invoice"
- Jika mengonfirmasi sudah bayar/nota lunas -> Pilih Stage "4. Closing Lunas"
- Jika menolak atau membatalkan -> Pilih Stage "5. Batal / Lost"

Jawab HANYA dalam format JSON valid:
{"stageId": "<ID_STAGE_DI_ATAS>", "amount": <ESTIMASI_NOMINAL_RUPIAH_ATAU_0>, "reason": "<ALASAN_SINGKAT_DALAM_1_KALIMAT>"}`;

    const aiRes = await chatComplete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Riwayat Chat:\n${chatHistory}` },
      ],
      "claude-sonnet-4.5",
    );

    let stageId = pipeline.stages[0]?.id;
    let amount = 0;
    let reason = "Otomatis dianalisis AI";

    if (aiRes.content) {
      try {
        const cleanJson = aiRes.content.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed.stageId && pipeline.stages.some((s) => s.id === parsed.stageId)) {
          stageId = parsed.stageId;
        }
        if (typeof parsed.amount === "number") {
          amount = parsed.amount;
        }
        if (parsed.reason) {
          reason = parsed.reason;
        }
      } catch {
        /* fallback to default stage */
      }
    }

    if (!stageId) return;

    // Check existing deal for this contact & pipeline
    const existingDeal = await prisma.pipelineDeal.findFirst({
      where: {
        tenantId: conv.tenantId,
        pipelineId: pipeline.id,
        contactId: conv.contactId,
      },
    });

    const dealTitle = `Deal - ${conv.contact.name || conv.contact.phone}`;

    if (existingDeal) {
      await prisma.pipelineDeal.update({
        where: { id: existingDeal.id },
        data: {
          stageId,
          conversationId: conv.id,
          title: dealTitle,
          amount: amount > 0 ? amount : existingDeal.amount,
          lastAiReason: reason,
        },
      });
    } else {
      await prisma.pipelineDeal.create({
        data: {
          tenantId: conv.tenantId,
          pipelineId: pipeline.id,
          stageId,
          contactId: conv.contactId,
          conversationId: conv.id,
          title: dealTitle,
          amount,
          lastAiReason: reason,
        },
      });
    }
  } catch (err) {
    console.warn("autoClassifyAndMoveDeal warning:", err);
  }
}
