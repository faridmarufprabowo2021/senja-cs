import { env } from "./env.js";

export interface CallSummaryResult {
  summary: string;
  keyTakeaways: string[];
  actionItems: string[];
}

export async function summarizeCall(transcript: string): Promise<CallSummaryResult> {
  if (!transcript || transcript.trim().length < 10) {
    return {
      summary: "Panggilan telepon singkat.",
      keyTakeaways: ["Percakapan berlangsung singkat."],
      actionItems: ["Hubungi kembali jika diperlukan."],
    };
  }

  if (!env.LLM_API_KEY) {
    return {
      summary: "Panggilan telepon WhatsApp diterima dari pelanggan.",
      keyTakeaways: ["Informasi detail dibahas melalui telepon."],
      actionItems: ["Lakukan konfirmasi ulang via chat."],
    };
  }

  try {
    const res = await fetch(`${env.LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.LLM_CHAT_MODEL || "claude-sonnet-4.5",
        messages: [
          {
            role: "system",
            content:
              "Kamu adalah AI Call Summarizer profesional. Analisis transkrip telepon WhatsApp berikut dan ekstrak ringkasan eksekutif dalam format JSON:\n" +
              '{\n  "summary": "Ringkasan 2 kalimat",\n  "keyTakeaways": ["Poin 1", "Poin 2"],\n  "actionItems": ["Action 1", "Action 2"]\n}\nHANYA kembalikan JSON valid tanpa Markdown fence.',
          },
          {
            role: "user",
            content: transcript,
          },
        ],
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      return {
        summary: "Panggilan telepon WhatsApp dari pelanggan.",
        keyTakeaways: [transcript.slice(0, 100)],
        actionItems: ["Follow up via WhatsApp."],
      };
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as CallSummaryResult;

    return {
      summary: parsed.summary || "Panggilan telepon WhatsApp selesai.",
      keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    };
  } catch (err) {
    console.warn("Call summarizer error:", err);
    return {
      summary: "Panggilan telepon WhatsApp selesai.",
      keyTakeaways: [transcript.slice(0, 100)],
      actionItems: ["Tindak lanjuti pesan pelanggan."],
    };
  }
}
