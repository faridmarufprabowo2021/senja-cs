import { env } from "./env.js";

export async function transcribeAudio(buffer: Buffer, filename: string): Promise<string> {
  if (!buffer || buffer.length === 0) return "";

  if (!env.LLM_API_KEY) {
    return "[Pesan Suara WA]: Pelanggan mengirimkan pesan suara.";
  }

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: "audio/ogg" });
    formData.append("file", blob, filename || "voice.ogg");
    formData.append("model", "whisper-1");

    const res = await fetch(`${env.LLM_BASE_URL.replace(/\/v1\/?$/, "")}/v1/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.LLM_API_KEY}`,
      },
      body: formData,
    });

    if (!res.ok) {
      return "[Pesan Suara WA]: (Gagal mentranskrip audio otomatis)";
    }

    const data = (await res.json()) as { text?: string };
    return data.text ? data.text.trim() : "[Pesan Suara WA]: (Suara kurang jelas)";
  } catch (err) {
    console.warn("Whisper transcription error:", err);
    return "[Pesan Suara WA]: (Pesan suara dari pelanggan)";
  }
}
