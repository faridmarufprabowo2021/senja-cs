import { env } from "./env.js";

export async function analyzeImage(buffer: Buffer, mimeType: string): Promise<string> {
  if (!buffer || buffer.length === 0) return "";

  if (!env.LLM_API_KEY) {
    return "Foto dari pelanggan (Bukti/Produk)";
  }

  try {
    const base64 = buffer.toString("base64");
    const dataUri = `data:${mimeType || "image/jpeg"};base64,${base64}`;

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
            role: "user",
            content: [
              {
                type: "text",
                text: "Ekstrak teks (OCR) dan jelaskan secara ringkas isi foto ini (misal: Bukti Transfer Mandiri Rp 250.000 atas nama Siapa, atau Foto Produk/Komplain apa). Jawab dalam 2-3 kalimat singkat.",
              },
              {
                type: "image_url",
                image_url: { url: dataUri },
              },
            ],
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      return "Foto dari pelanggan";
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const ans = data.choices?.[0]?.message?.content;
    return ans ? ans.trim() : "Foto dari pelanggan";
  } catch (err) {
    console.warn("Vision AI analysis error:", err);
    return "Foto dari pelanggan";
  }
}
