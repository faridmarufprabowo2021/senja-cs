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
  const primaryApiKey = env.LLM_API_KEY;
  const kagiroApiKey = env.KAGIRO_API_KEY;
  const groqApiKey = env.GROQ_API_KEY;

  if (!primaryApiKey && !kagiroApiKey && !groqApiKey) {
    console.warn("chatComplete: no LLM keys configured — extractive fallback");
    return { content: extractiveAnswer(messages) };
  }

  const requestedModel = (model && model.trim()) || env.LLM_CHAT_MODEL;

  // Attempt 1: Try Kagiro API (kagiro/qwen3-8max) as Primary Provider for testing
  if (kagiroApiKey) {
    try {
      const kagiroBase = env.KAGIRO_BASE_URL.replace(/\/$/, "");
      const kagiroModel = env.KAGIRO_CHAT_MODEL;
      const bodyPayload: any = {
        model: kagiroModel,
        messages,
        temperature: 0.4,
        max_tokens: 600,
      };

      if (tools && tools.length > 0) {
        bodyPayload.tools = tools.map((t) => ({
          type: "function",
          function: t,
        }));
      }

      const res = await fetch(`${kagiroBase}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kagiroApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });
      const rawBody = await res.text();

      if (res.ok) {
        const parsed = parseChatResponseBody(rawBody);
        if (parsed.ok && (parsed.content || (parsed.toolCalls && parsed.toolCalls.length > 0))) {
          console.log(`[llm] Answered via Primary Kagiro LLM (${kagiroModel})`);
          return {
            content: parsed.content,
            toolCalls: parsed.toolCalls,
          };
        }
      }
      console.warn(`[llm] Kagiro LLM model ${kagiroModel} failed:`, res.status, rawBody.slice(0, 150));
    } catch (kagiroErr) {
      console.warn(`[llm] Kagiro LLM fetch error:`, kagiroErr);
    }
  }

  // Attempt 2: Auto Failover to OpenAgentic / Custom Gateway
  if (primaryApiKey) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const base = env.LLM_BASE_URL.replace(/\/$/, "");
        const bodyPayload: any = {
          model: requestedModel,
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
            Authorization: `Bearer ${primaryApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyPayload),
        });
        const rawBody = await res.text();

        if (res.ok) {
          const parsed = parseChatResponseBody(rawBody);
          if (parsed.ok && (parsed.content || (parsed.toolCalls && parsed.toolCalls.length > 0))) {
            return {
              content: parsed.content,
              toolCalls: parsed.toolCalls,
            };
          }
        }

        if (res.status === 503 && attempt === 1) {
          console.warn("[llm] OpenAgentic LLM returned 503 (resetting), retrying in 1.5s...");
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        console.warn("[llm] OpenAgentic LLM API failed, failing over to Groq:", res.status, rawBody.slice(0, 150));
        break;
      } catch (err) {
        console.warn("[llm] OpenAgentic LLM fetch error, failing over to Groq:", err);
        break;
      }
    }
  }

  // Attempt 2: Auto Failover to Groq API (High-Speed Llama 3) if Groq key exists
  if (groqApiKey) {
    const groqModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];
    for (const groqModel of groqModels) {
      try {
        const bodyPayload: any = {
          model: groqModel,
          messages,
          temperature: 0.4,
          max_tokens: 600,
        };

        if (tools && tools.length > 0) {
          bodyPayload.tools = tools.map((t) => ({
            type: "function",
            function: t,
          }));
        }

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyPayload),
        });
        const rawBody = await res.text();

        if (res.ok) {
          const parsed = parseChatResponseBody(rawBody);
          if (parsed.ok && (parsed.content || (parsed.toolCalls && parsed.toolCalls.length > 0))) {
            return {
              content: parsed.content,
              toolCalls: parsed.toolCalls,
            };
          }
        }
        console.warn(`[llm] Groq LLM model ${groqModel} failed:`, res.status, rawBody.slice(0, 150));
      } catch (groqErr) {
        console.warn(`[llm] Groq LLM model ${groqModel} fetch error:`, groqErr);
      }
    }
  }

  // Attempt 3: Final Extractive Knowledge Base Fallback
  return { content: extractiveAnswer(messages) };
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
    return "Maaf, saya belum menemukan informasi di knowledge base. Silakan ketik *cs* bila ingin dihubungkan ke agent kami.";
  }

  const q = user.toLowerCase().trim();
  if (
    /^(halo|hai|hi|hello|pagi|siang|sore|malam|assalam|selamat)[\s!.]*$/i.test(
      q,
    )
  ) {
    return "Halo! Ada yang bisa kami bantu? Silakan tanya jadwal dokter, harga layanan, booking, atau info tempat kami.";
  }

  const firstChunk = context.split(/\n---\n/)[0]?.trim() ?? context;
  const cleaned = firstChunk
    .replace(/^\[\d+\][^\n]*\n/, "")
    .trim();
  
  // Format markdown table lines into clean bullet points
  const lines = cleaned.split("\n");
  const formattedLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2 && !cells[0].includes("---") && !cells[0].toLowerCase().includes("dokter") && !cells[0].toLowerCase().includes("nama")) {
        formattedLines.push(`• ${cells.join(" — ")}`);
      }
    } else if (trimmed) {
      formattedLines.push(trimmed);
    }
  }
  const result = formattedLines.join("\n");
  const short =
    result.length > 450 ? result.slice(0, 430).trim() + "…" : result;

  return short;
}
