import { env, hasLlm } from "./env.js";

export type ChatMessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ChatMessageContentPart[];
  tool_call_id?: string;
  name?: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatCompleteResponse = {
  content: string;
  toolCalls?: ToolCall[];
};

export function parseChatResponseBody(rawBody: string): {
  content: string;
  toolCalls?: ToolCall[];
  ok: boolean;
  parseError?: string;
} {
  let text = rawBody.trim();
  text = text.replace(/(?:\r?\n)?data:\s*\[DONE\]\s*$/i, "").trim();
  if (text.startsWith("data:")) {
    const line = text
      .split(/\r?\n/)
      .map((l) => l.replace(/^data:\s*/, "").trim())
      .find((l) => l && l !== "[DONE]" && l.startsWith("{"));
    text = line ?? text.replace(/^data:\s*/, "");
  }
  const lastBrace = text.lastIndexOf("}");
  if (lastBrace > 0 && lastBrace < text.length - 1) {
    const maybe = text.slice(0, lastBrace + 1);
    try {
      JSON.parse(maybe);
      text = maybe;
    } catch {
      /* keep original */
    }
  }

  try {
    const data = JSON.parse(text) as {
      choices?: {
        message?: {
          content?: string | Array<{ type?: string; text?: string }>;
          tool_calls?: ToolCall[];
        };
      }[];
      error?: { message?: string };
    };
    if (data.error?.message) {
      return { content: "", ok: false, parseError: data.error.message };
    }
    const msg = data.choices?.[0]?.message;
    const raw = msg?.content;
    const content =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw.map((p) => (typeof p === "string" ? p : p.text ?? "")).join("")
          : "";

    return {
      content: content.trim(),
      toolCalls: msg?.tool_calls,
      ok: true,
    };
  } catch (err) {
    return {
      content: "",
      ok: false,
      parseError: err instanceof Error ? err.message : "invalid JSON",
    };
  }
}

export async function chatComplete(
  messages: ChatMessage[],
  model?: string,
  tools?: any[],
): Promise<ChatCompleteResponse> {
  if (!hasLlm) {
    console.warn("chatComplete: no LLM_API_KEY — extractive fallback");
    return { content: extractiveAnswer(messages) };
  }

  const useModel = (model && model.trim()) || env.LLM_CHAT_MODEL;

  try {
    const base = env.LLM_BASE_URL.replace(/\/$/, "");
    const bodyPayload: any = {
      model: useModel,
      messages,
      temperature: 0.4,
      max_tokens: 500,
    };

    if (tools && tools.length > 0) {
      bodyPayload.tools = tools.map((t) => ({
        type: "function",
        function: t,
      }));
    }

    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    });
    const rawBody = await res.text();

    if (!res.ok) {
      console.warn(
        "chat API failed, extractive fallback",
        res.status,
        useModel,
        rawBody.slice(0, 400),
      );
      return { content: extractiveAnswer(messages) };
    }

    const parsed = parseChatResponseBody(rawBody);
    if (!parsed.ok || (!parsed.content && (!parsed.toolCalls || parsed.toolCalls.length === 0))) {
      console.warn(
        "chat API parse/empty, extractive fallback",
        parsed.parseError,
        rawBody.slice(0, 200),
      );
      return { content: extractiveAnswer(messages) };
    }
    return {
      content: parsed.content,
      toolCalls: parsed.toolCalls,
    };
  } catch (err) {
    console.warn("chat error, extractive fallback", err);
    return { content: extractiveAnswer(messages) };
  }
}

/** Offline fallback: return best context chunk as short reply. */
function extractiveAnswer(messages: ChatMessage[]): string {
  const sysRaw = messages.find((m) => m.role === "system")?.content ?? "";
  const system = typeof sysRaw === "string" ? sysRaw : "";
  const userRaw = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const user = typeof userRaw === "string" ? userRaw : (userRaw.find((p) => p.type === "text") as any)?.text ?? "";

  const ctxMatch = system.match(
    /Context(?:\s+knowledge)?[^\n]*:\s*\n([\s\S]*?)(?:\nHistory:|\nAturan:|\nUser:|$)/i,
  );
  let context = ctxMatch?.[1]?.trim() ?? "";
  if (!context || context === "(tidak ada)") {
    const alt = system.match(
      /Context[^\n]*\n([\s\S]*?)(?:\nHistory:|\nAturan:|$)/i,
    );
    context = alt?.[1]?.trim() ?? "";
  }
  if (!context || context === "(tidak ada)") {
    return "Maaf, saya belum menemukan informasi di knowledge base. Ketik *cs* untuk dihubungkan ke agent kami.";
  }

  const q = user.toLowerCase().trim();
  if (
    /^(halo|hai|hi|hello|pagi|siang|sore|malam|assalam|selamat)[\s!.]*$/i.test(
      q,
    )
  ) {
    return "Halo! Ada yang bisa kami bantu? Silakan tanya jam buka, harga, booking, atau layanan kami.";
  }

  const firstChunk = context.split(/\n---\n/)[0]?.trim() ?? context;
  const cleaned = firstChunk
    .replace(/^\[\d+\][^\n]*\n/, "")
    .trim();
  const short =
    cleaned.length > 400 ? cleaned.slice(0, 380).trim() + "…" : cleaned;

  if (q.includes("harga") || q.includes("berapa") || q.includes("biaya")) {
    return `${short}\n\n_Jawaban dari knowledge base (LLM sementara tidak tersedia). Ketik *cs* bila butuh agent._`;
  }
  return `${short}\n\n_Sumber knowledge base (LLM sementara tidak tersedia). Ketik *cs* untuk agent._`;
}
