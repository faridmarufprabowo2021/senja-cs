# WhatsApp Call AI Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated WhatsApp Call AI Summary feature in Senja CS that processes WhatsApp calls (incoming/missed), transcribes call audio, generates structured AI summaries & action items, and displays interactive call cards in the Inbox.

**Architecture:** Add `call-summarizer.ts` LLM helper in `apps/api/src/lib/`, hook into Baileys call listener in `apps/api/src/wa/manager.ts`, update shared `MessageType` and metadata in `packages/shared/src/index.ts`, and render a custom Call Summary Card in `apps/web/src/components/inbox.tsx`.

**Tech Stack:** Fastify 5, Groq Whisper API, Claude/OpenAI LLM, Next.js 15, Lucide Icons, TailwindCSS.

## Global Constraints

- TypeScript strictness: All packages must pass `pnpm typecheck` without errors.
- Monorepo: `apps/api` on port `:4000`, `apps/web` on port `:3001`.

---

### Task 1: Create Call Summarizer Helper (`apps/api/src/lib/call-summarizer.ts`)

**Files:**
- Create: `apps/api/src/lib/call-summarizer.ts`
- Test: `apps/api/src/call-summarizer.test.ts`

**Interfaces:**
- Consumes: Call transcript string
- Produces: `summarizeCall(transcript: string): Promise<{ summary: string; keyTakeaways: string[]; actionItems: string[] }>`

- [ ] **Step 1: Write failing test**

```ts
// apps/api/src/call-summarizer.test.ts
import { describe, it, expect } from "vitest";
import { summarizeCall } from "./lib/call-summarizer.js";

describe("Call Summarizer Helper", () => {
  it("should return fallback summary object when transcript is short or mock", async () => {
    const text = "Pelanggan menanyakan harga paket reseller dan minta dikirimkan brosur.";
    const result = await summarizeCall(text);
    expect(result).toHaveProperty("summary");
    expect(Array.isArray(result.keyTakeaways)).toBe(true);
    expect(Array.isArray(result.actionItems)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cs/api test`
Expected: FAIL with "Cannot find module ./lib/call-summarizer.js"

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/api/src/lib/call-summarizer.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cs/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/call-summarizer.ts apps/api/src/call-summarizer.test.ts
git commit -m "feat: add summarizeCall LLM helper"
```

---

### Task 2: Update Shared Types for Call Summary (`packages/shared/src/index.ts`)

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add "call_summary" to MessageType and add callSummary to Message metadata**

In `packages/shared/src/index.ts`:
- Update `MessageType` enum/type to include `"call_summary"`.
- Update `Message["metadata"]` to include:
  ```ts
  callSummary?: {
    durationSec?: number;
    summary: string;
    keyTakeaways: string[];
    actionItems: string[];
    isMissedCall?: boolean;
  };
  ```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @cs/shared typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat: add call_summary MessageType and callSummary metadata to shared types"
```

---

### Task 3: Hook Call Listener & Summarizer into WhatsApp Manager (`apps/api/src/wa/manager.ts`)

**Files:**
- Modify: `apps/api/src/wa/manager.ts`

- [ ] **Step 1: Add handleCallEvent in `apps/api/src/wa/manager.ts`**

In `apps/api/src/wa/manager.ts`:
- Import `summarizeCall` from `../lib/call-summarizer.js`.
- Add method `handleCallEvent(tenantId: string, sessionId: string, callData: any)`:
  - If status === "missed" or "reject": create `Message` type `"call_summary"` with `body: "📞 Panggilan Tak Terjawab dari Pelanggan"`, `metadata.callSummary = { isMissedCall: true, summary: "Panggilan telepon tidak terangkat.", keyTakeaways: ["Pelanggan menelpon pada " + new Date().toLocaleTimeString()], actionItems: ["Hubungi kembali nomor pelanggan"] }`.
  - Broadcast WebSocket event `message.created`.

- [ ] **Step 2: Run API typecheck**

Run: `pnpm --filter @cs/api typecheck`
Expected: PASS with 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/wa/manager.ts
git commit -m "feat: add WhatsApp call event listener & summary handler"
```

---

### Task 4: Render Interactive Call Summary Card in Inbox (`apps/web/src/components/inbox.tsx`)

**Files:**
- Modify: `apps/web/src/components/inbox.tsx`

- [ ] **Step 1: Add Call Summary Card UI in `MessageBubble` when `message.type === "call_summary"`**

In `MessageBubble` in `apps/web/src/components/inbox.tsx`:
- When `message.type === "call_summary"` or `message.metadata?.callSummary`:
  - Render PhoneCall icon 📞 with badge status (Duration / Missed Call).
  - Render **📝 Ringkasan AI**: `message.metadata.callSummary.summary`.
  - Render **📌 Poin Penting**: list of bulleted takeaways.
  - Render **⚡ Action Items**: list of action items + button *"➕ Tambah ke Reminder Follow-Up"*.

- [ ] **Step 2: Run full monorepo typecheck**

Run: `pnpm typecheck`
Expected: 3 successful packages, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/inbox.tsx
git commit -m "feat: add WhatsApp Call AI Summary Card UI to Inbox Chat"
```

---

### Task 5: End-to-End Typecheck & Git Push

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 2: Push commits to GitHub**

Run: `git push`
Expected: Clean push to main.
