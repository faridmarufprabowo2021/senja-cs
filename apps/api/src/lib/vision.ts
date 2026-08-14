import { env } from "./env.js";

export async function analyzeImage(buffer: Buffer, mimeType: string): Promise<string> {
  if (!buffer || buffer.length === 0) return "";

  const primaryApiKey = env.LLM_API_KEY;
  const groqApiKey = env.GROQ_API_KEY;

  if (!primaryApiKey && !groqApiKey) {
    return "Foto dari pelanggan (Bukti/Produk)";
  }

  const base64 = buffer.toString("base64");
  const dataUri = `data:${mimeType || "image/jpeg"};base64,${base64}`;

  const promptText =
    "Ekstrak teks (OCR) dan jelaskan secara ringkas isi foto ini (misal: Bukti Transfer Mandiri Rp 250.000 atas nama Siapa, Nomor Resi, atau Foto Produk/Komplain apa). Jawab singkat dan jelas.";

  // Attempt 1: Try Primary Provider if key exists
  if (primaryApiKey) {
    try {
      const base = env.LLM_BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${primaryApiKey}`,
        },
        body: JSON.stringify({
          model: env.LLM_CHAT_MODEL || "claude-sonnet-4.5",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: dataUri } },
              ],
            },
          ],
          max_tokens: 250,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const ans = data.choices?.[0]?.message?.content;
        if (ans && ans.trim()) return ans.trim();
      }
    } catch (err) {
      console.warn("Primary Vision AI error, failing over to Groq Vision:", err);
    }
  }

  // Attempt 2: Groq High-Speed Vision & OCR Model (llama-3.2-11b-vision-preview)
  if (groqApiKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.2-11b-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: dataUri } },
              ],
            },
          ],
          max_tokens: 250,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const ans = data.choices?.[0]?.message?.content;
        if (ans && ans.trim()) return ans.trim();
      }
    } catch (groqErr) {
      console.warn("Groq Vision OCR error:", groqErr);
    }
  }

  return "Foto dari pelanggan";
}
