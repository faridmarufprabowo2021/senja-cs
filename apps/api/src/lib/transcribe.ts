import { env } from "./env.js";

export async function transcribeAudio(buffer: Buffer, filename: string): Promise<string> {
  if (!buffer || buffer.length === 0) return "";

  const apiKey = env.GROQ_API_KEY || env.LLM_API_KEY;
  if (!apiKey) {
    return "[Pesan Suara WA]: Pelanggan mengirimkan pesan suara.";
  }

  const endpoint = env.GROQ_API_KEY
    ? "https://api.groq.com/openai/v1/audio/transcriptions"
    : `${env.LLM_BASE_URL.replace(/\/v1\/?$/, "")}/v1/audio/transcriptions`;
  const model = env.GROQ_API_KEY ? "whisper-large-v3-turbo" : "whisper-1";

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: "audio/ogg" });
    formData.append("file", blob, filename || "voice.ogg");
    formData.append("model", model);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("Whisper transcription HTTP error:", res.status, errText);
      return "[Pesan Suara WA]: (Gagal mentranskrip audio otomatis)";
    }

    const data = (await res.json()) as { text?: string };
    return data.text ? data.text.trim() : "[Pesan Suara WA]: (Suara kurang jelas)";
  } catch (err) {
    console.warn("Whisper transcription error:", err);
    return "[Pesan Suara WA]: (Pesan suara dari pelanggan)";
  }
}
