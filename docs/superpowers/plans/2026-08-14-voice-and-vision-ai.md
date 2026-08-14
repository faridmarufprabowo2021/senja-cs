# AI Voice Note Transcribe & Multimodal Vision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated AI Voice Note Transcriber (Whisper) and Multimodal Vision Image Reader (Claude/GPT-4o Vision) so the AI Bot can read audio notes and images sent by customers, and reply intelligently in Senja CS.

**Architecture:** Extend backend API (`apps/api`) with `transcribe.ts` (Whisper API) and `vision.ts` (Vision OCR/Analysis), hook into Baileys inbound message handler (`wa/manager.ts`), update AI Bot RAG (`bot/reply.ts`), and enhance Frontend Inbox (`apps/web/src/components/inbox.tsx`) with an HTML5 Audio Player + Transcript Toggle and Vision Analysis Badge.

**Tech Stack:** Fastify 5, OpenAI Whisper API / Claude Vision, Node.js 20+, Next.js 15, TailwindCSS, Lucide Icons.

## Global Constraints

- Monorepo: `apps/api` on port `:4000`, `apps/web` on port `:3001`.
- TypeScript strictness: All files must pass `pnpm typecheck` without errors.
- Fallbacks: If API key is missing or fails, audio is saved normally for manual playback by CS agents and image is logged gracefully without breaking the chat stream.

---

### Task 1: Create Audio Transcriber Helper (`apps/api/src/lib/transcribe.ts`)

**Files:**
- Create: `apps/api/src/lib/transcribe.ts`
- Test: `apps/api/src/transcribe.test.ts`

**Interfaces:**
- Consumes: Audio file path or Buffer (`Buffer`)
- Produces: `transcribeAudio(buffer: Buffer, filename: string): Promise<string>`

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/transcribe.test.ts
import { describe, it, expect } from "vitest";
import { transcribeAudio } from "./lib/transcribe.js";

describe("Audio Transcriber Helper", () => {
  it("should return fallback string when audio buffer is empty or mock", async () => {
    const dummyBuffer = Buffer.from("RIFF....WAVEfmt ");
    const text = await transcribeAudio(dummyBuffer, "test.ogg");
    expect(typeof text).toBe("string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cs/api test`
Expected: FAIL with "Cannot find module ./lib/transcribe.js"

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/api/src/lib/transcribe.ts
import { env } from "./env.js";

export async function transcribeAudio(buffer: Buffer, filename: string): Promise<string> {
  if (!buffer || buffer.length === 0) return "";
  
  if (!env.LLM_API_KEY) {
    return "[Pesan Suara WA]: Pelanggan mengirimkan pesan suara.";
  }

  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: "audio/ogg" });
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cs/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/transcribe.ts apps/api/src/transcribe.test.ts
git commit -m "feat: add transcribeAudio Whisper API helper"
```

---

### Task 2: Create Multimodal Vision Image Reader Helper (`apps/api/src/lib/vision.ts`)

**Files:**
- Create: `apps/api/src/lib/vision.ts`
- Test: `apps/api/src/vision.test.ts`

**Interfaces:**
- Consumes: Image file Buffer & mimeType
- Produces: `analyzeImage(buffer: Buffer, mimeType: string): Promise<string>`

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/vision.test.ts
import { describe, it, expect } from "vitest";
import { analyzeImage } from "./lib/vision.js";

describe("Vision Image Reader Helper", () => {
  it("should return image description string", async () => {
    const dummyImg = Buffer.from("fake-image-bytes");
    const result = await analyzeImage(dummyImg, "image/jpeg");
    expect(typeof result).toBe("string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cs/api test`
Expected: FAIL with "Cannot find module ./lib/vision.js"

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/api/src/lib/vision.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cs/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/vision.ts apps/api/src/vision.test.ts
git commit -m "feat: add analyzeImage Multimodal Vision helper"
```

---

### Task 3: Hook Voice Transcribe & Vision Analysis into WhatsApp Manager & Bot Reply Engine

**Files:**
- Modify: `apps/api/src/wa/manager.ts`
- Modify: `apps/api/src/bot/reply.ts`

- [ ] **Step 1: Modify `wa/manager.ts` to trigger transcribeAudio & analyzeImage on inbound audio & image messages**

Update inbound audio handler in `apps/api/src/wa/manager.ts`:
- Import `transcribeAudio` from `../lib/transcribe.js`
- Import `analyzeImage` from `../lib/vision.js`
- When `type === "audio"`, call `transcribeAudio()`, set `body = 🎙️ [Pesan Suara]: ${transcript}`, and set `metadata.transcript = transcript`.
- When `type === "image"`, call `analyzeImage()`, set `metadata.imageAnalysis = analysis`.

- [ ] **Step 2: Update `bot/reply.ts` so AI Bot prompt reads voice transcripts and image descriptions**

Update `apps/api/src/bot/reply.ts`:
```ts
const userQuery = lastIn.metadata?.transcript || lastIn.metadata?.imageAnalysis || lastIn.body;
```
Pass `userQuery` into RAG knowledge retriever and LLM system prompt so AI Bot answers customer voice notes and photos intelligently.

- [ ] **Step 3: Test API compilation & type safety**

Run: `pnpm --filter @cs/api typecheck`
Expected: PASS with 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/wa/manager.ts apps/api/src/bot/reply.ts
git commit -m "feat: connect Voice Transcribe & Vision Analysis to Baileys & AI Bot reply"
```

---

### Task 4: Enhance Frontend Inbox UI for Voice Note Audio Player & Vision Analysis Badge (`apps/web/src/components/inbox.tsx`)

**Files:**
- Modify: `apps/web/src/components/inbox.tsx`

- [ ] **Step 1: Render HTML5 Audio Player Card in `MessageBubble` when `message.type === "audio"`**

In `MessageBubble`:
- Render `<audio controls src={mediaUrl} className="w-full max-w-[240px] my-1" />`
- Render collapsible button `"📝 Lihat Transkrip AI"` showing `message.metadata?.transcript || message.body`.

- [ ] **Step 2: Render Vision Badge in `MessageBubble` when `message.type === "image"`**

In `MessageBubble`:
- Next to image preview, if `message.metadata?.imageAnalysis`, render a subtle badge:  
  `👁️ AI Vision: {message.metadata.imageAnalysis}`

- [ ] **Step 3: Run typecheck to verify frontend**

Run: `pnpm --filter @cs/web typecheck`
Expected: PASS with 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/inbox.tsx
git commit -m "feat: add Audio Player & Vision Badge UI to Inbox Chat"
```

---

### Task 5: End-to-End Monorepo Typecheck & Verification

- [ ] **Step 1: Run full typecheck across all packages**

Run: `pnpm typecheck`
Expected: 3 successful packages, 0 errors.
